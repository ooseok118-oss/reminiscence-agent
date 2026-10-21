import { z } from "zod";
import type { Profile } from "./profile";
import type { Expansion, Seed } from "./qloo-types";

// Shared by the browser and the server: what a caregiver records after a session, and
// what the planning agent decided to change for the next one.

export const REACTIONS = ["enjoyed", "neutral", "uneasy"] as const;
export type Reaction = (typeof REACTIONS)[number];

const type = z.enum(["artist", "movie", "tv_show"]);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const name = z.string().trim().min(1).max(240);

export const feedbackSchema = z.object({ entity_id: uuid, name, type, reaction: z.enum(REACTIONS) });
export type Feedback = z.infer<typeof feedbackSchema>;

export const replanRequestSchema = z.object({
  seeds: z.array(z.object({ entity_id: uuid, name, type, origin: z.enum(["favorite", "session"]).optional() })).min(1).max(4),
  feedback: z.array(feedbackSchema).min(1).max(12),
  note: z.string().trim().max(300),
  shown_ids: z.array(uuid).max(80),
});

// Most favorites the next search uses at once. Keeps Qloo's signal focused and the
// "Why this" sentence readable.
export const MAX_SEEDS = 4;
const MAX_NEW_SEEDS = 2;

// What the model may return. The server checks it against the feedback before use.
export const agentDecisionSchema = z.object({
  new_starting_points: z.array(z.string().max(100)).max(6),
  keep_favorites: z.array(z.string().max(100)).max(6),
  extra_topics_to_avoid: z.array(z.string().max(80)).max(10),
  rationale: z.string().trim().min(1).max(700),
  next_focus: z.string().trim().max(160),
});
export type AgentDecisionOutput = z.infer<typeof agentDecisionSchema>;

export type AgentDecision = {
  seeds: Seed[];
  added: string[];
  set_aside: string[];
  extra_topics: string[];
  rationale: string;
  next_focus: string;
  source: "agent" | "rules";
};
export type ReplanResponse = { decision: AgentDecision; expansion: Expansion; profile: Profile };

type Request = z.infer<typeof replanRequestSchema>;
// Items added from feedback are marked "session" so "Why this" can say they were enjoyed before.
const asSeed = (item: { entity_id: string; name: string; type: Seed["type"]; origin?: Seed["origin"] }, origin = item.origin ?? "favorite"): Seed =>
  ({ entity_id: item.entity_id.toUpperCase(), name: item.name, type: item.type, popularity: null, release_year: null, origin });
const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

function topicList(values: string[], existing: string[]) {
  const seen = new Set(existing.map((topic) => topic.toLowerCase()));
  const topics: string[] = [];
  for (const raw of values) {
    const topic = raw.replace(/\s+/g, " ").trim();
    const words = topic.split(" ").length;
    if (!topic || words > 4 || !/^[\p{L}\p{N} '&-]+$/u.test(topic) || seen.has(topic.toLowerCase())) continue;
    seen.add(topic.toLowerCase());
    topics.push(topic);
  }
  return topics.slice(0, 3);
}

/**
 * Turns the model's decision into a safe, bounded plan of action. New starting points
 * must be items the caregiver marked "enjoyed"; kept favorites must be the originals.
 * Anything else the model names is ignored.
 */
export function applyDecision(request: Request, output: AgentDecisionOutput, existingTopics: string[]): AgentDecision {
  const enjoyed = request.feedback.filter((item) => item.reaction === "enjoyed");
  const added = enjoyed.filter((item) => output.new_starting_points.some((id) => same(id, item.entity_id))).slice(0, MAX_NEW_SEEDS);
  let kept = request.seeds.filter((seed) => output.keep_favorites.some((id) => same(id, seed.entity_id)));
  if (!kept.length && !added.length) kept = request.seeds;
  kept = kept.slice(0, MAX_SEEDS - added.length);
  const seeds = [...new Map([...kept.map((item) => asSeed(item)), ...added.map((item) => asSeed(item, "session"))].map((seed) => [seed.entity_id, seed])).values()];
  return {
    seeds,
    added: added.map((item) => item.name),
    set_aside: request.feedback.filter((item) => item.reaction === "uneasy").map((item) => item.name),
    extra_topics: topicList(output.extra_topics_to_avoid, existingTopics),
    rationale: output.rationale,
    next_focus: output.next_focus,
    source: "agent",
  };
}

const list = (names: string[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** The same kind of decision made by plain rules, used when the model is unavailable. */
export function ruleDecision(request: Request, firstName: string): AgentDecision {
  const enjoyed = request.feedback.filter((item) => item.reaction === "enjoyed").slice(0, MAX_NEW_SEEDS);
  const kept = request.seeds.slice(0, MAX_SEEDS - enjoyed.length);
  const uneasy = request.feedback.filter((item) => item.reaction === "uneasy").map((item) => item.name);
  const parts = [
    enjoyed.length ? `${firstName} enjoyed ${list(enjoyed.map((item) => item.name))}, so the next search starts from there too.` : "The next search keeps the original favorites.",
    uneasy.length ? `${list(uneasy)} ${uneasy.length === 1 ? "is" : "are"} set aside.` : "",
    "Everything already used is left out so the session feels fresh.",
  ];
  return {
    seeds: [...new Map([...kept.map((item) => asSeed(item)), ...enjoyed.map((item) => asSeed(item, "session"))].map((seed) => [seed.entity_id, seed])).values()],
    added: enjoyed.map((item) => item.name),
    set_aside: uneasy,
    extra_topics: [],
    rationale: parts.filter(Boolean).join(" "),
    next_focus: "",
    source: "rules",
  };
}
