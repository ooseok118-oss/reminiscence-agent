import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { generateText, jsonSchema, Output } from "ai";
import { z } from "zod";
import { SAFETY_PROMPT, SAFETY_CONTRACT } from "./safetyPrompt";
import { SESSION_PROMPT, SESSION_CONTRACT } from "./prompt";
import { generatedPlanSchema, validatePlan, validateVerdicts, verdictSchema, type ReviewedItem } from "./plan-schema";
import type { Profile } from "./profile";
import type { QlooItem } from "./qloo-types";
import { simplifyModelSchema } from "./model-schema";

export const GEMINI_MODEL = "gemini-3.5-flash-lite";
export class PlanningError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

async function structured<T>(stage: string, system: string, input: unknown, schema: z.ZodType<T>, validate: (data: T) => T, deadline: number): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new PlanningError("Gemini is not configured on the server. Please contact the site owner.", 503);
  const google = createGoogle({ apiKey: key });
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) throw new PlanningError("Planning took too long. Please try again.", 504);
    let generated = false;
    try {
      const { output } = await generateText({
        model: google(GEMINI_MODEL),
        system, prompt: JSON.stringify({ input, correction: feedback || undefined }),
        output: Output.object({ schema: jsonSchema<T>(simplifyModelSchema(z.toJSONSchema(schema)) as Record<string, unknown>, {
          validate: (value) => {
            const parsed = schema.safeParse(value);
            return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
          },
        }) }),
        providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
        maxOutputTokens: stage === "safety" ? 6500 : 2500,
        maxRetries: 0, abortSignal: AbortSignal.timeout(Math.min(25_000, remaining)),
      });
      generated = true;
      return validate(output);
    } catch (error) {
      const details = error as { name?: string; statusCode?: number };
      const invalidOutput = generated || /NoObjectGenerated|NoOutputGenerated|NoContentGenerated|TypeValidation|JSONParse/.test(details.name ?? "");
      console.error("Gemini request failed", { stage, attempt: attempt + 1, status: details.statusCode ?? null, reason: invalidOutput ? "invalid_output" : "provider_or_timeout" });
      if (!invalidOutput) throw new PlanningError(details.statusCode === 429
        ? "Gemini is busy or its quota is exhausted. Please wait and try again."
        : "Gemini could not complete this request. Please try again.", details.statusCode === 429 ? 429 : 502);
      if (attempt === 1) throw new PlanningError("Gemini returned an invalid result twice. No session was released. Please try again.");
      feedback = generated && error instanceof Error ? error.message : "Return complete, valid JSON matching the schema exactly.";
    }
  }
  throw new PlanningError("Unable to create a valid plan.");
}

export async function reviewItems(items: QlooItem[], profile: Profile, deadline: number): Promise<ReviewedItem[]> {
  const schema = z.object({ verdicts: z.array(verdictSchema).min(1).max(72) });
  const output = await structured("safety", `${SAFETY_PROMPT}\n\n${SAFETY_CONTRACT}\nWrap the verdict array in the schema's verdicts property.`, {
    topics_to_avoid: [...profile.topicsToAvoid, profile.otherTopicsToAvoid].filter(Boolean),
    qloo_items: items.map(({ entity_id, name, type, description, release_year }) => ({ entity_id, name, type, description, release_year })),
  }, schema, (data) => { validateVerdicts(data.verdicts, items); return data; }, deadline);
  return validateVerdicts(output.verdicts, items);
}

export async function generatePlan(items: ReviewedItem[], profile: Profile) {
  if (!items.some((item) => item.type === "artist" && item.verdict !== "exclude")) {
    throw new PlanningError("No reviewed music remains for the opening. Try other favorites.", 422);
  }
  let approved = items.filter((item) => item.verdict !== "exclude");
  // Excluded titles and reasons never enter the planning prompt.
  approved = approved.map((item) => ({ ...item, reason: "" }));
  const topics = [...profile.topicsToAvoid, profile.otherTopicsToAvoid].filter(Boolean);
  const output = await structured("plan", `${SESSION_PROMPT}\n\n${SESSION_CONTRACT}`, {
    profile, qloo_items: approved,
  }, generatedPlanSchema, (data) => { validatePlan(data, approved, topics); return data; }, Date.now() + 52_000);
  return validatePlan(output, approved, topics);
}
