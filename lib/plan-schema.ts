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
// Counts are deliberately loose here: validatePlan trims extras and repairs harmless
// formatting slips, so a safe plan is never thrown away over a fourth song.
const base = z.object({ entity_id: z.string().max(100), item: z.string().max(240), safe_angle: z.string().max(180) });
const utterance = text(300);
const list = (max: number) => z.array(text(max)).max(8);
export const generatedPlanSchema = z.object({
  opening_song: base.extend({ songs: list(120), caregiver_tip: utterance }),
  conversation: z.array(base.extend({ prompts: z.array(utterance).min(1).max(6) })).min(1).max(6),
  sensory_activity: base.extend({ activity: utterance, materials: list(80) }),
  closing: base.extend({ songs: list(120), caregiver_tip: utterance }),
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

const HARD_TOPICS = ["war", "genocide", "holocaust", "nazi", "nazism", "murder", "suicide", "terminal illness", "violent crime"];
// Memory tests: asking to recall a date, or to name who starred in or sang something.
// "Who sang along with you?" is a warm question and stays allowed.
const QUIZ = /\b(remember|recall)\b|\b(what|which) year\b|\bwho (starred|played) in\b|\bwho sang (it|this|that|the)\b/i;
// Asking someone to come up with titles or names is also a memory test.
const TITLE_RECALL = /^(what|which) (songs?|films?|movies?|shows?|titles?|singers?|actors?|actresses)\b/i;
const QUESTION_START = /^(what|how|who|where)\b/i;

// Compare text that may differ only in case, quotes, punctuation or accents.
function loose(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[‘’“”'"`.,!?;:()\-]/g, "").replace(/\s+/g, " ").trim();
}

// Returns why a read-aloud line is unsafe or unsuitable, or null when it is fine.
function lineProblem(line: string, topics: string[]): string | null {
  if (line.split(/\s+/).length >= 25) return "Keep each read-aloud prompt under 25 words.";
  if (QUIZ.test(line)) return "Do not quiz or request recall.";
  for (const topic of [...HARD_TOPICS, ...topics].filter(Boolean)) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(line)) return "Plan touched a topic to avoid.";
  }
  return null;
}

function questionProblem(line: string, topics: string[]): string | null {
  if (!QUESTION_START.test(line)) return "Start each conversation question with What, How, Who or Where; keep permission choices in caregiver tips.";
  if (TITLE_RECALL.test(line)) return "Do not ask them to name songs, films, titles or people.";
  return lineProblem(line, topics);
}

// Plain, safe wording used only when the model's own text for a slot cannot be used.
const OPENING_TIP = "Play it softly. Listening quietly is fine, and you can pause anytime.";
const CLOSING_TIP = "Play something calm to wind down, and thank them for sharing.";
function questionsFor(item: ReviewedItem): string[] {
  if (item.type === "artist") {
    return [`What do you enjoy about the music of ${item.name}?`, "Who did you like to listen to music with?", "Where did you go to hear music or dance?"];
  }
  const kind = item.type === "movie" ? "films" : "TV";
  return [`What do you enjoy about ${item.name}?`, `Who did you like to watch ${kind} with?`, `How did you spend evenings when ${item.name} was on?`];
}
function activityFor(item: ReviewedItem) {
  return { activity: `Look at printed photos from ${item.name} together and talk about the clothes and colors.`, materials: [`Printed photos from ${item.name}`] };
}

type Entry = { entity_id: string; item: string; safe_angle: string };

/**
 * Checks a generated plan against the approved Qloo pool and the read-aloud rules.
 * Normal mode throws on the first real problem so the model can retry with feedback.
 * With `fallback` (the final attempt), any slot that cannot be used is filled from the
 * approved pool with plain wording instead, so a safe plan is always released.
 * Safety never relaxes: excluded items, unapproved angles and avoided topics stay out.
 */
export function validatePlan(plan: GeneratedPlan, items: ReviewedItem[], topics: string[], options: { fallback?: boolean } = {}): SessionPlan {
  const fallback = options.fallback ?? false;
  const requirements = planRequirements(items);
  const pool = items.filter((item) => item.verdict !== "exclude");
  const used = new Set<string>();

  // The entity_id is authoritative; a name that differs only by quotes or case still resolves.
  const resolve = (entry: Entry): ReviewedItem => {
    const id = entry.entity_id.trim().toLowerCase();
    const item = pool.find((candidate) => candidate.entity_id.toLowerCase() === id)
      ?? (entry.item ? pool.find((candidate) => loose(candidate.name) === loose(entry.item)) : undefined);
    if (!item) throw new Error("Plan used an item outside the approved Qloo pool.");
    if (lineProblem(item.name, topics)) throw new Error("Plan touched a topic to avoid.");
    if (item.verdict === "caution") {
      const given = loose(entry.safe_angle);
      const angle = item.safe_angles.find((option) => loose(option) === given)
        ?? (given ? item.safe_angles.find((option) => loose(option).includes(given) || given.includes(loose(option))) : undefined);
      if (!angle) throw new Error(`Caution item ${item.name} needs one of its approved safe angles.`);
    }
    return item;
  };
  const describe = (item: ReviewedItem): PlanEntry => ({ item: item.name, type: item.type, why_this: item.why_this ?? "" });
  const instruction = (line: string, backup: string) => {
    const problem = lineProblem(line, topics);
    if (!problem) return line;
    if (fallback) return backup;
    throw new Error(problem);
  };
  // Optional extras: an unsuitable song or material is dropped, never allowed through.
  const extras = (values: string[], max: number) => values.filter((value) => !lineProblem(value, topics)).slice(0, max);
  // An approved item not yet used. Plain wording is only paired with "ok" items, except
  // music, where listening stays within any music-related safe angle.
  const spare = (kinds: ItemType[], avoid: Set<string>) => {
    const fits = (item: ReviewedItem) => kinds.includes(item.type) && !lineProblem(item.name, topics)
      && (item.verdict === "ok" || item.type === "artist");
    const choice = pool.find((item) => fits(item) && !avoid.has(item.entity_id)) ?? pool.find(fits);
    if (!choice) throw new Error("Not enough approved Qloo items to build a session. Try other favorites.");
    return choice;
  };
  const attempt = <T,>(build: () => T, backup: () => T): T => {
    try { return build(); } catch (error) { if (!fallback) throw error; return backup(); }
  };

  const opening = attempt(() => {
    const item = resolve(plan.opening_song);
    if (item.type !== "artist") throw new Error("Opening needs a Qloo artist.");
    return { ...describe(item), id: item.entity_id, songs: extras(plan.opening_song.songs, 2), caregiver_tip: instruction(plan.opening_song.caregiver_tip, OPENING_TIP) };
  }, () => {
    const item = spare(["artist"], used);
    return { ...describe(item), id: item.entity_id, songs: [], caregiver_tip: OPENING_TIP };
  });
  used.add(opening.id);

  // One topic per required type. Extra or unusable topics are skipped when a good one exists.
  const conversation: (PlanEntry & { id: string; prompts: string[] })[] = [];
  for (const kind of requirements.conversation_types) {
    let problem = `Conversation needs exactly one item of each type: ${requirements.conversation_types.join(", ")}.`;
    let topic: (PlanEntry & { id: string; prompts: string[] }) | null = null;
    for (const entry of plan.conversation) {
      try {
        const item = resolve(entry);
        if (item.type !== kind || conversation.some((chosen) => chosen.id === item.entity_id)) continue;
        if (fallback && requirements.all_distinct && used.has(item.entity_id)) continue;
        let prompts = entry.prompts.filter((line) => !questionProblem(line, topics));
        if (prompts.length < 3 && fallback && item.verdict === "ok") {
          prompts = [...prompts, ...questionsFor(item).filter((line) => !prompts.includes(line))];
        }
        if (prompts.length < 3) {
          const bad = entry.prompts.find((line) => questionProblem(line, topics));
          problem = bad ? questionProblem(bad, topics)! : "Write at least three questions for each conversation item.";
          continue;
        }
        topic = { ...describe(item), id: item.entity_id, prompts: leadWithItem(item.name, prompts.slice(0, 3)) };
        break;
      } catch (error) {
        problem = error instanceof Error ? error.message : problem;
      }
    }
    if (!topic) {
      if (!fallback) throw new Error(problem);
      const item = spare([kind], new Set([...used, ...conversation.map((chosen) => chosen.id)]));
      topic = { ...describe(item), id: item.entity_id, prompts: questionsFor(item) };
    }
    conversation.push(topic);
    used.add(topic.id);
  }

  const sensory = attempt(() => {
    const item = resolve(plan.sensory_activity);
    if (!requirements.sensory_types.includes(item.type)) throw new Error(`Sensory activity needs one of: ${requirements.sensory_types.join(", ")}.`);
    if (fallback && requirements.all_distinct && used.has(item.entity_id)) throw new Error("Already used.");
    const backup = activityFor(item);
    const activity = instruction(plan.sensory_activity.activity, backup.activity);
    return { ...describe(item), id: item.entity_id, activity, materials: activity === backup.activity ? backup.materials : extras(plan.sensory_activity.materials, 4) };
  }, () => {
    const item = spare(requirements.sensory_types, used);
    return { ...describe(item), id: item.entity_id, ...activityFor(item) };
  });
  used.add(sensory.id);

  const closing = attempt(() => {
    const item = resolve(plan.closing);
    if (item.type !== "artist") throw new Error("Closing needs a Qloo artist.");
    if (requirements.distinct_music && item.entity_id === opening.id) throw new Error("Use different artists for the opening and closing.");
    if (fallback && requirements.all_distinct && used.has(item.entity_id)) throw new Error("Already used.");
    return { ...describe(item), id: item.entity_id, songs: extras(plan.closing.songs, 2), caregiver_tip: instruction(plan.closing.caregiver_tip, CLOSING_TIP) };
  }, () => {
    const item = spare(["artist"], used);
    return { ...describe(item), id: item.entity_id, songs: [], caregiver_tip: CLOSING_TIP };
  });

  const ids = [opening.id, ...conversation.map((topic) => topic.id), sensory.id, closing.id];
  if (!fallback && requirements.all_distinct && new Set(ids).size !== ids.length) throw new Error("Never use the same item twice in one session.");

  const strip = <T extends { id: string }>({ id, ...rest }: T) => { void id; return rest; };
  return {
    opening_song: strip(opening),
    conversation: conversation.map(strip),
    sensory_activity: strip(sensory),
    closing: strip(closing),
  };
}
