import { z } from "zod";
import { GEMINI_MODEL, GEMINI_PLAN_MODEL, generatePlan, PlanningError, reviewItems } from "@/lib/gemini-server";
import { itemSchema, profileSchema, verdictSchema, type ReviewedItem, type SafetyReport } from "@/lib/plan-schema";
import { expandCategory, expansionInput, QlooError, readBody } from "@/lib/qloo-server";
import { record } from "@/lib/qloo-data";
import { seal, unseal } from "@/lib/proof";
import type { Expansion } from "@/lib/qloo-types";

export const maxDuration = 60;
export const runtime = "nodejs";

function verifiedProof(value: unknown, purpose: string, secret: "QLOO_API_KEY" | "GEMINI_API_KEY") {
  if (typeof value !== "string" || value.length > 180_000) throw new PlanningError("Search again to refresh the results.", 400);
  try { return record(unseal(value, purpose, secret)); }
  catch { throw new PlanningError("Results have expired or changed. Please search again.", 400); }
}

export async function POST(request: Request) {
  let phase = "input";
  try {
    const body = await readBody(request, 200_000);
    if (body.action === "review") {
      phase = "safety";
      const deadline = Date.now() + 52_000;
      const profile = profileSchema.parse(body.profile);
      const expansion = verifiedProof(body.proof, "qloo-expansion", "QLOO_API_KEY") as unknown as Expansion;
      if (expansion.era.from !== profile.birthYear + 10 || expansion.era.to !== profile.birthYear + 30) throw new PlanningError("Birth year changed. Search again.", 400);
      const items = z.array(itemSchema).min(1).max(36).parse(expansion.categories.flatMap((category) => category.items));
      const unique = [...new Map(items.map((item) => [item.entity_id, item])).values()];
      let reviewed = await reviewItems(unique, profile, deadline);
      const warnings: string[] = [];
      // No tags are imposed. Lower popularity first, then widen the era.
      // Bounded refills never admit an item that has not been screened.
      for (const widen of [false, true]) {
        const lowCategories = expansion.categories.filter((category) => reviewed.filter((item) => item.type === category.type && item.verdict !== "exclude").length < 3);
        if (!lowCategories.length || deadline - Date.now() < 12_000 || reviewed.length >= 72) break;
        const { seeds } = expansionInput({ birthYear: profile.birthYear, seeds: expansion.seeds });
        const refilled = await Promise.all(lowCategories.map((category) => expandCategory(category.type, seeds, expansion.era.from - (widen ? 5 : 0), expansion.era.to + (widen ? 5 : 0), true, deadline - 8000)));
        const additions = [...new Map(refilled.flatMap((category) => category.items).filter((item) => !reviewed.some((old) => old.entity_id === item.entity_id)).map((item) => [item.entity_id, item])).values()].slice(0, 72 - reviewed.length);
        if (additions.length && deadline - Date.now() > 2000) {
          try { reviewed = [...reviewed, ...await reviewItems(additions, profile, deadline)]; }
          catch { warnings.push("Extra candidates could not be reviewed and were not admitted to the plan."); }
        }
        warnings.push(widen ? "Sparse categories were searched with a five-year wider era. Every admitted addition was screened again." : "Sparse categories were searched with lower popularity thresholds. Every admitted addition was screened again.");
      }
      for (const type of ["movie", "tv_show", "artist"]) {
        if (reviewed.filter((item) => item.type === type && item.verdict !== "exclude").length < 3) warnings.push(`Fewer than three reviewed ${type === "artist" ? "music" : type === "movie" ? "movie" : "TV"} candidates remain. Safety rules were kept unchanged.`);
      }
      const counts = { exclude: 0, caution: 0, ok: 0 };
      for (const item of reviewed) counts[item.verdict]++;
      const review: SafetyReport = { items: reviewed, counts, warnings };
      const receipt = seal({ profile, items: reviewed.filter((item) => item.verdict !== "exclude") }, "reviewed-pool", "GEMINI_API_KEY");
      return Response.json({ review, receipt, model: GEMINI_MODEL }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "generate") {
      phase = "plan";
      const receipt = verifiedProof(body.receipt, "reviewed-pool", "GEMINI_API_KEY");
      const profile = profileSchema.parse(receipt.profile);
      const items: ReviewedItem[] = z.array(itemSchema.and(verdictSchema)).min(1).max(72).parse(receipt.items);
      if (items.some((item) => item.verdict === "exclude")) throw new PlanningError("Invalid reviewed pool.", 400);
      const plan = await generatePlan(items, profile);
      return Response.json({ plan, model: GEMINI_PLAN_MODEL }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new PlanningError("Choose review or generate.", 400);
  } catch (error) {
    const status = error instanceof PlanningError || error instanceof QlooError ? error.status : error instanceof z.ZodError ? 400 : 500;
    console.error("Planning route failed", { stage: phase, status });
    const message = error instanceof PlanningError || error instanceof QlooError ? error.message : status === 400 ? "Invalid profile or result data. Please search again." : "Planning could not be completed. Please try again.";
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
