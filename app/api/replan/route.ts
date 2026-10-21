import { z } from "zod";
import { decideNextSession, PlanningError } from "@/lib/gemini-server";
import { profileSchema } from "@/lib/plan-schema";
import type { FavoriteType } from "@/lib/profile";
import { seal } from "@/lib/proof";
import { expandCategory, QlooError, readBody } from "@/lib/qloo-server";
import type { Expansion } from "@/lib/qloo-types";
import { replanRequestSchema, type ReplanResponse } from "@/lib/replan-schema";

export const maxDuration = 60;
export const runtime = "nodejs";

// Between sessions: the agent reads the caregiver's feedback, decides which favorites
// should guide the next Qloo search, and runs that search without anything already used
// or anything that seemed to upset the person. The result goes through the same safety
// review and planning routes as the first session.
export async function POST(request: Request) {
  try {
    const body = await readBody(request, 40_000);
    const profile = profileSchema.parse(body.profile);
    const input = replanRequestSchema.parse({ seeds: body.seeds, feedback: body.feedback, note: body.note ?? "", shown_ids: body.shown_ids ?? [] });

    const decision = await decideNextSession(input, profile);
    const nextProfile = { ...profile, topicsToAvoid: [...profile.topicsToAvoid, ...decision.extra_topics].slice(0, 10) };
    const era = { from: profile.birthYear + 10, to: profile.birthYear + 30 };
    const exclude = [...new Set([...input.shown_ids, ...input.feedback.map((item) => item.entity_id)].map((id) => id.toUpperCase()))];
    const categories = await Promise.all((["movie", "tv_show", "artist"] as FavoriteType[])
      .map((type) => expandCategory(type, decision.seeds, era.from, era.to, false, undefined, exclude)));
    const result: Expansion = { seeds: decision.seeds, era, categories, exclude, safety_reviewed: false };
    const response: ReplanResponse = { decision, expansion: { ...result, proof: seal(result, "qloo-expansion", "QLOO_API_KEY") }, profile: nextProfile };
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof PlanningError || error instanceof QlooError ? error.status : error instanceof z.ZodError ? 400 : 500;
    console.error("Replan route failed", { status });
    const message = error instanceof PlanningError || error instanceof QlooError ? error.message
      : status === 400 ? "Invalid feedback. Please mark at least one item and try again." : "The next session could not be planned. Please try again.";
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
