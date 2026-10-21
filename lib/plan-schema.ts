import { z } from "zod";

const type = z.enum(["artist", "movie", "tv_show"]);
const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
export const profileSchema = z.object({
  firstName: text(60), birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
  hometown: text(120), knownFavorites: z.array(z.object({ type, name: text(120) })).min(1).max(3),
  topicsToAvoid: z.array(text(120)).max(10), otherTopicsToAvoid: z.string().trim().max(500),
});

export const itemSchema = z.object({
  entity_id: uuid, name: text(240), type,
  release_year: z.number().int().nullable(), start_year: z.number().int().nullable(), end_year: z.number().int().nullable(),
  description: z.string().max(600), popularity: z.number().min(0).max(1).nullable(),
  because_of: z.array(z.object({ entity_id: uuid, name: text(240), score: z.number().min(0).max(1) })).max(3),
  why_this: z.string().max(800).nullable(),
});
export const verdictSchema = z.object({
  entity_id: text(100), verdict: z.enum(["exclude", "caution", "ok"]),
  reason: text(500), safe_angles: z.array(text(180)).max(3),
});
export type Verdict = z.infer<typeof verdictSchema>;
export type ReviewedItem = z.infer<typeof itemSchema> & Verdict;

// Output IDs are checked against the exact input pool after generation. Avoid
// complex UUID regexes in Google's constrained decoding schema.
const base = z.object({ entity_id: text(100), item: text(240), why_this: z.string().max(800), safe_angle: z.string().max(180) });
const utterance = text(300);
export const generatedPlanSchema = z.object({
  opening_song: base.extend({ caregiver_tip: utterance }),
  conversation: z.array(base.extend({ prompts: z.array(utterance).length(3) })).min(1).max(2),
  sensory_activity: base.extend({ activity: utterance }),
  closing: base.extend({ caregiver_tip: utterance }),
});
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
export type SessionPlan = {
  opening_song: { item: string; why_this: string; caregiver_tip: string };
  conversation: { item: string; why_this: string; prompts: string[] }[];
  sensory_activity: { item: string; why_this: string; activity: string };
  closing: { item: string; why_this: string; caregiver_tip: string };
};
export type SafetyReport = {
  items: ReviewedItem[];
  counts: { exclude: number; caution: number; ok: number };
  warnings: string[];
};
export type ReviewResponse = { review: SafetyReport; receipt: string; model: string };
export type PlanResponse = { plan: SessionPlan; model: string };

export function validateVerdicts(verdicts: Verdict[], items: z.infer<typeof itemSchema>[]): ReviewedItem[] {
  const ids = new Set(items.map((item) => item.entity_id));
  if (verdicts.length !== ids.size || new Set(verdicts.map((v) => v.entity_id)).size !== ids.size || verdicts.some((v) => !ids.has(v.entity_id))) {
    throw new Error("Review must cover every item exactly once.");
  }
  return items.map((item) => {
    const verdict = verdicts.find((v) => v.entity_id === item.entity_id)!;
    if (verdict.verdict === "caution" && verdict.safe_angles.length < 2) throw new Error("Caution needs two or three safe angles.");
    if (verdict.verdict !== "caution" && verdict.safe_angles.length) throw new Error("Only caution items may have safe angles.");
    return { ...item, ...verdict };
  });
}

export function validatePlan(plan: GeneratedPlan, items: ReviewedItem[], topics: string[]): SessionPlan {
  const entries = [plan.opening_song, ...plan.conversation, plan.sensory_activity, plan.closing];
  for (const entry of entries) {
    const item = items.find((item) => item.entity_id === entry.entity_id && item.verdict !== "exclude");
    if (!item || entry.item !== item.name) throw new Error("Plan used an item outside the approved Qloo pool.");
    if (item.verdict === "caution" && !item.safe_angles.includes(entry.safe_angle)) throw new Error("Caution item needs an approved safe angle.");
    if (item.verdict === "ok" && entry.safe_angle !== "") throw new Error("Unexpected safe angle.");
    const utterances = "prompts" in entry ? entry.prompts : "activity" in entry ? [entry.activity] : [entry.caregiver_tip];
    if ("prompts" in entry && entry.prompts.some((text) => !/^(what|how)\b/i.test(text))) throw new Error("Start each conversation question with What or How; keep permission choices in caregiver tips.");
    if (utterances.some((text) => text.split(/\s+/).length >= 25)) throw new Error("Keep each read-aloud prompt under 25 words.");
    const allText = [entry.item, ...utterances].join(" ");
    if (/\b(remember|recall)\b|\b(what|which) year\b|\bwho (played|sang|starred)\b/i.test(allText)) throw new Error("Do not quiz or request recall.");
    const hardTopics = ["war", "genocide", "holocaust", "nazi", "nazism", "murder", "suicide", "terminal illness", "violent crime"];
    for (const topic of [...hardTopics, ...topics].filter(Boolean)) {
      const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(allText)) throw new Error("Plan touched a topic to avoid.");
    }
    // Keep source attribution deterministic; missing metadata stays missing.
    entry.why_this = item.why_this ?? "";
  }
  const opening = items.find((item) => item.entity_id === plan.opening_song.entity_id);
  if (opening?.type !== "artist") throw new Error("Opening needs a Qloo artist, without an invented song.");
  const clean = <T extends { entity_id: string; safe_angle: string }>(entry: T) => {
    const { entity_id, safe_angle, ...rest } = entry;
    void entity_id; void safe_angle;
    return rest;
  };
  return { opening_song: clean(plan.opening_song), conversation: plan.conversation.map(clean), sensory_activity: clean(plan.sensory_activity), closing: clean(plan.closing) };
}
