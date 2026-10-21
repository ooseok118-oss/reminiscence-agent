import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { generateText, jsonSchema, Output } from "ai";
import { z } from "zod";
import { SAFETY_PROMPT, SAFETY_CONTRACT } from "./safetyPrompt";
import { SESSION_PROMPT, SESSION_CONTRACT } from "./prompt";
import { generatedPlanSchema, planRequirements, validatePlan, validateVerdicts, verdictSchema, type ReviewedItem, type SessionPlan } from "./plan-schema";
import type { Profile } from "./profile";
import type { QlooItem } from "./qloo-types";
import { simplifyModelSchema } from "./model-schema";

export const GEMINI_MODEL = "gemini-3.5-flash-lite";
// The session plan is the part people read, so its model can be switched without a
// code change: set GEMINI_PLAN_MODEL (for example "gemini-3.5-flash") in Vercel.
const configuredPlanModel = process.env.GEMINI_PLAN_MODEL?.trim() ?? "";
export const GEMINI_PLAN_MODEL = /^gemini-[a-z0-9.-]{1,60}$/.test(configuredPlanModel) ? configuredPlanModel : GEMINI_MODEL;
export class PlanningError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

async function structured<T>(stage: string, model: string, system: string, input: unknown, schema: z.ZodType<T>, validate: (data: T, lastAttempt: boolean) => T, deadline: number): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new PlanningError("Gemini is not configured on the server. Please contact the site owner.", 503);
  const google = createGoogle({ apiKey: key });
  let feedback = "";
  // The plan has more rules to satisfy than the screening, so it gets one extra attempt.
  const attempts = stage === "plan" ? 3 : 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) throw new PlanningError("Planning took too long. Please try again.", 504);
    let generated = false;
    try {
      const { output } = await generateText({
        model: google(model),
        system, prompt: JSON.stringify({ input, correction: feedback || undefined }),
        output: Output.object({ schema: jsonSchema<T>(simplifyModelSchema(z.toJSONSchema(schema)) as Record<string, unknown>, {
          validate: (value) => {
            const parsed = schema.safeParse(value);
            return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
          },
        }) }),
        providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
        maxOutputTokens: stage === "safety" ? 6500 : 4000,
        maxRetries: 0, abortSignal: AbortSignal.timeout(Math.min(25_000, remaining)),
      });
      generated = true;
      return validate(output, attempt === attempts - 1);
    } catch (error) {
      const details = error as { name?: string; statusCode?: number };
      const invalidOutput = generated || /NoObjectGenerated|NoOutputGenerated|NoContentGenerated|TypeValidation|JSONParse/.test(details.name ?? "");
      // Rule violations are our own messages (no user data), so they are safe to log for diagnosis.
      const rule = generated && error instanceof Error ? error.message.slice(0, 160) : null;
      console.error("Gemini request failed", { stage, attempt: attempt + 1, status: details.statusCode ?? null, reason: invalidOutput ? "invalid_output" : "provider_or_timeout", rule });
      if (!invalidOutput) throw new PlanningError(details.statusCode === 429
        ? "Gemini is busy or its quota is exhausted. Please wait and try again."
        : "Gemini could not complete this request. Please try again.", details.statusCode === 429 ? 429 : 502);
      if (attempt === attempts - 1) throw new PlanningError("Gemini could not write a plan that passed every safety and format check. No session was released. Please try again.");
      feedback = generated && error instanceof Error ? error.message : "Return complete, valid JSON matching the schema exactly.";
    }
  }
  throw new PlanningError("Unable to create a valid plan.");
}

export async function reviewItems(items: QlooItem[], profile: Profile, deadline: number): Promise<ReviewedItem[]> {
  const schema = z.object({ verdicts: z.array(verdictSchema).min(1).max(72) });
  const output = await structured("safety", GEMINI_MODEL, `${SAFETY_PROMPT}\n\n${SAFETY_CONTRACT}\nWrap the verdict array in the schema's verdicts property.`, {
    topics_to_avoid: [...profile.topicsToAvoid, profile.otherTopicsToAvoid].filter(Boolean),
    qloo_items: items.map(({ entity_id, name, type, description, release_year }) => ({ entity_id, name, type, description, release_year })),
  }, schema, (data) => { validateVerdicts(data.verdicts, items); return data; }, deadline);
  return validateVerdicts(output.verdicts, items);
}

export async function generatePlan(items: ReviewedItem[], profile: Profile): Promise<SessionPlan> {
  if (!items.some((item) => item.type === "artist" && item.verdict !== "exclude")) {
    throw new PlanningError("No reviewed music remains for the opening. Try other favorites.", 422);
  }
  let approved = items.filter((item) => item.verdict !== "exclude");
  // Excluded titles and reasons never enter the planning prompt.
  approved = approved.map((item) => ({ ...item, reason: "" }));
  const topics = [...profile.topicsToAvoid, profile.otherTopicsToAvoid].filter(Boolean);
  const requirements = planRequirements(approved);
  // Only the fields the planner needs. Attribution ("why_this") is added by the server afterwards.
  const qlooItems = approved.map(({ entity_id, name, type, release_year, description, verdict, safe_angles }) =>
    ({ entity_id, name, type, release_year, description, verdict, safe_angles }));
  // Early attempts are strict so the model can improve with feedback. On the last attempt,
  // a slot it still gets wrong is filled from the approved pool instead of failing the session.
  let plan = null as SessionPlan | null;
  await structured("plan", GEMINI_PLAN_MODEL, `${SESSION_PROMPT}\n\n${SESSION_CONTRACT}`, {
    profile, requirements, qloo_items: qlooItems,
  }, generatedPlanSchema, (data, lastAttempt) => { plan = validatePlan(data, approved, topics, { fallback: lastAttempt }); return data; }, Date.now() + 52_000);
  if (!plan) throw new PlanningError("Unable to create a valid plan.");
  return plan;
}
