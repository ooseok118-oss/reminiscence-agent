import { z } from "zod";

const type = z.enum(["artist", "movie", "tv_show"]);
type ItemType = z.infer<typeof type>;
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
// "why_this" is not generated: the server writes it from Qloo explainability scores.
const base = z.object({ entity_id: text(100), item: text(240), safe_angle: z.string().max(180) });
const utterance = text(300);
const songs = z.array(text(120)).max(2);
export const generatedPlanSchema = z.object({
  opening_song: base.extend({ songs, caregiver_tip: utterance }),
  conversation: z.array(base.extend({ prompts: z.array(utterance).length(3) })).min(1).max(3),
  sensory_activity: base.extend({ activity: utterance, materials: z.array(text(80)).max(4) }),
  closing: base.extend({ songs, caregiver_tip: utterance }),
});
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;

type PlanEntry = { item: string; type: ItemType; why_this: string };
export type SessionPlan = {
  opening_song: PlanEntry & { songs: string[]; caregiver_tip: string };
  conversation: (PlanEntry & { prompts: string[] })[];
  sensory_activity: PlanEntry & { activity: string; materials: string[] };
  closing: PlanEntry & { songs: string[]; caregiver_tip: string };
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

export type PlanRequirements = {
  /** One conversation item per listed type, in any order. */
  conversation_types: ItemType[];
  /** Types the sensory activity may use. */
  sensory_types: ItemType[];
  /** True when the approved pool is large enough for six different items. */
  all_distinct: boolean;
  /** True when the opening and closing can use different artists. */
  distinct_music: boolean;
};

// The ideal session uses one film, one TV show and one artist in the conversation,
// plus different artists for the opening and closing. A sparse pool after safety
// review relaxes only what it cannot supply; safety rules never relax.
export function planRequirements(items: ReviewedItem[]): PlanRequirements {
  const usable = items.filter((item) => item.verdict !== "exclude");
  const count = (kind: ItemType) => usable.filter((item) => item.type === kind).length;
  const artists = count("artist"), movies = count("movie"), shows = count("tv_show");
  const conversation_types: ItemType[] = [];
  if (movies) conversation_types.push("movie");
  if (shows) conversation_types.push("tv_show");
  if (artists >= 3) conversation_types.push("artist");
  if (!conversation_types.length) conversation_types.push("artist");
  const sensory_types: ItemType[] = movies + shows ? ["movie", "tv_show"] : ["artist"];
  const artistsNeeded = 2 + (conversation_types.includes("artist") ? 1 : 0) + (sensory_types.includes("artist") ? 1 : 0);
  const visualsNeeded = conversation_types.filter((kind) => kind !== "artist").length + (sensory_types.includes("artist") ? 0 : 1);
  return {
    conversation_types, sensory_types,
    all_distinct: artists >= artistsNeeded && movies + shows >= visualsNeeded,
    distinct_music: artists >= 2,
  };
}

// The opening question should tie the topic to the Qloo item, so the caregiver sees why it
// was chosen. A question that names the item moves to the front; if none does, the order
// stays as written. This is a presentation fix, never a reason to discard a safe plan.
export function leadWithItem(item: string, prompts: string[]): string[] {
  const core = (value: string) => value.toLowerCase().replace(/[‘’]/g, "'").replace(/^the\s+/, "").replace(/\s+/g, " ").trim();
  const index = prompts.findIndex((prompt) => core(prompt).includes(core(item)));
  return index > 0 ? [prompts[index], ...prompts.slice(0, index), ...prompts.slice(index + 1)] : prompts;
}

const HARD_TOPICS =["war", "genocide", "holocaust", "nazi", "nazism", "murder", "suicide", "terminal illness", "violent crime"];

export function validatePlan(plan: GeneratedPlan, items: ReviewedItem[], topics: string[]): SessionPlan {
  const requirements = planRequirements(items);
  const approved = (entityId: string) => items.find((item) => item.entity_id === entityId && item.verdict !== "exclude");
  const entries = [plan.opening_song, ...plan.conversation, plan.sensory_activity, plan.closing];
  for (const entry of entries) {
    const item = approved(entry.entity_id);
    if (!item || entry.item !== item.name) throw new Error("Plan used an item outside the approved Qloo pool.");
    if (item.verdict === "caution" && !item.safe_angles.includes(entry.safe_angle)) throw new Error("Caution item needs an approved safe angle.");
    if (item.verdict === "ok" && entry.safe_angle !== "") throw new Error("Unexpected safe angle.");
    const utterances = "prompts" in entry ? entry.prompts : "activity" in entry ? [entry.activity] : [entry.caregiver_tip];
    if ("prompts" in entry && entry.prompts.some((line) => !/^(what|how|who|where)\b/i.test(line))) {
      throw new Error("Start each conversation question with What, How, Who or Where; keep permission choices in caregiver tips.");
    }
    if (utterances.some((line) => line.split(/\s+/).length >= 25)) throw new Error("Keep each read-aloud prompt under 25 words.");
    const extras = "songs" in entry ? entry.songs : "materials" in entry ? entry.materials : [];
    const allText = [entry.item, ...utterances, ...extras].join(" ");
    if (/\b(remember|recall)\b|\b(what|which) year\b|\bwho (played|sang|starred)\b/i.test(allText)) throw new Error("Do not quiz or request recall.");
    for (const topic of [...HARD_TOPICS, ...topics].filter(Boolean)) {
      const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(allText)) throw new Error("Plan touched a topic to avoid.");
    }
  }

  const kind = (entityId: string) => approved(entityId)!.type;
  if (kind(plan.opening_song.entity_id) !== "artist") throw new Error("Opening needs a Qloo artist.");
  if (kind(plan.closing.entity_id) !== "artist") throw new Error("Closing needs a Qloo artist.");
  const conversationTypes = plan.conversation.map((entry) => kind(entry.entity_id)).sort();
  if (conversationTypes.join() !== [...requirements.conversation_types].sort().join()) {
    throw new Error(`Conversation needs exactly one item of each type: ${requirements.conversation_types.join(", ")}.`);
  }
  if (!requirements.sensory_types.includes(kind(plan.sensory_activity.entity_id))) {
    throw new Error(`Sensory activity needs one of: ${requirements.sensory_types.join(", ")}.`);
  }
  const conversationIds = plan.conversation.map((entry) => entry.entity_id);
  if (new Set(conversationIds).size !== conversationIds.length) throw new Error("Use a different item for each conversation topic.");
  if (requirements.distinct_music && plan.opening_song.entity_id === plan.closing.entity_id) throw new Error("Use different artists for the opening and closing.");
  const allIds = entries.map((entry) => entry.entity_id);
  if (requirements.all_distinct && new Set(allIds).size !== allIds.length) throw new Error("Never use the same item twice in one session.");

  // Source attribution is deterministic: it comes from Qloo scores, never from the model.
  const describe = (entityId: string): PlanEntry => {
    const item = approved(entityId)!;
    return { item: item.name, type: item.type, why_this: item.why_this ?? "" };
  };
  return {
    opening_song: { ...describe(plan.opening_song.entity_id), songs: plan.opening_song.songs, caregiver_tip: plan.opening_song.caregiver_tip },
    conversation: plan.conversation.map((entry) => ({ ...describe(entry.entity_id), prompts: leadWithItem(entry.item, entry.prompts) })),
    sensory_activity: { ...describe(plan.sensory_activity.entity_id), activity: plan.sensory_activity.activity, materials: plan.sensory_activity.materials },
    closing: { ...describe(plan.closing.entity_id), songs: plan.closing.songs, caregiver_tip: plan.closing.caregiver_tip },
  };
}
