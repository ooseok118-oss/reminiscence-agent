import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVerdicts, validatePlan, generatedPlanSchema, profileSchema } from "../lib/plan-schema.ts";
import { simplifyModelSchema } from "../lib/model-schema.ts";

const artist = { entity_id: "95593E4D-2CBE-44E5-BF82-F1E542B63A96", name: "Frank Sinatra", type: "artist", why_this: "Inspired by Elvis Presley", verdict: "ok", safe_angles: [] };
const film = { entity_id: "D6E8D940-2FBA-424A-ABFA-E1341F22E3B4", name: "West Side Story", type: "movie", why_this: "Inspired by Roman Holiday", verdict: "caution", safe_angles: ["The dancing", "The costumes"] };
const excluded = { entity_id: "D6E8D940-2FBA-424A-ABFA-E1341F22E3B5", name: "Cabaret", type: "movie", verdict: "exclude", safe_angles: [] };
const items = [artist, film, excluded];
function plan() {
  const entry = (item, extra) => ({ entity_id: item.entity_id, item: item.name, why_this: "invented claim", safe_angle: item.safe_angles[0] ?? "", ...extra });
  return {
    opening_song: entry(artist, { caregiver_tip: "Offer a familiar recording, with the choice to listen quietly." }),
    conversation: [entry(film, { prompts: ["What do you enjoy about the dancing?", "How do the costumes make you feel?", "What colors catch your eye?"] })],
    sensory_activity: entry(film, { activity: "Offer a colorful fabric to look at while chatting about the costumes." }),
    closing: entry(artist, { caregiver_tip: "Offer quiet listening, or a pause if that feels better." }),
  };
}

test("review coverage rejects omissions, duplicates and unknown IDs", () => {
  const verdicts = items.map(({ entity_id, verdict, safe_angles }) => ({ entity_id, verdict, safe_angles, reason: "Reviewed" }));
  assert.equal(validateVerdicts(verdicts, items).length, 3);
  assert.throws(() => validateVerdicts(verdicts.slice(1), items), /every item/);
  assert.throws(() => validateVerdicts([verdicts[0], verdicts[0], verdicts[2]], items), /every item/);
  assert.throws(() => validateVerdicts([{ ...verdicts[0], entity_id: "unknown" }, ...verdicts.slice(1)], items), /every item/);
  assert.throws(() => validateVerdicts([verdicts[0], { ...verdicts[1], safe_angles: [] }, verdicts[2]], items), /safe angles/);
});

test("a valid plan preserves the requested JSON shape and Qloo source attribution", () => {
  const result = validatePlan(generatedPlanSchema.parse(plan()), items, ["War"]);
  assert.equal(result.opening_song.why_this, artist.why_this);
  assert.equal(result.conversation[0].why_this, film.why_this);
  assert.equal("entity_id" in result.opening_song, false);
  assert.equal("safe_angle" in result.conversation[0], false);
  assert.equal(result.conversation[0].prompts.length, 3);
});

test("excluded items, invented titles and unapproved caution angles cannot enter the plan", () => {
  let bad = plan(); bad.closing.entity_id = excluded.entity_id; bad.closing.item = excluded.name;
  assert.throws(() => validatePlan(bad, items, []), /approved Qloo pool/);
  bad = plan(); bad.opening_song.item = "A song invented by the model";
  assert.throws(() => validatePlan(bad, items, []), /approved Qloo pool/);
  bad = plan(); bad.conversation[0].safe_angle = "The violent plot";
  assert.throws(() => validatePlan(bad, items, []), /approved safe angle/);
});

test("read-aloud text rejects quizzes, long prompts and explicit avoided topics", () => {
  let bad = plan(); bad.conversation[0].prompts[0] = "What year do you remember this coming out?";
  assert.throws(() => validatePlan(bad, items, []), /quiz/);
  bad = plan(); bad.conversation[0].prompts[0] = "What " + Array(24).fill("word").join(" ");
  assert.throws(() => validatePlan(bad, items, []), /under 25/);
  bad = plan(); bad.conversation[0].prompts[0] = "What did you enjoy about the war scenes?";
  assert.throws(() => validatePlan(bad, items, ["War"]), /topic to avoid/);
  bad = plan(); bad.closing.caregiver_tip = "Talk about hospitals.";
  assert.throws(() => validatePlan(bad, items, ["Hospitals"]), /topic to avoid/);
  bad = plan(); bad.conversation[0].prompts[0] = "Would you like to talk about this?";
  assert.throws(() => validatePlan(bad, items, []), /What or How/);
});

test("malformed output and unbounded profiles fail schema validation", () => {
  assert.equal(generatedPlanSchema.safeParse({ conversation: [] }).success, false);
  const bad = plan(); bad.conversation[0].prompts.pop();
  assert.equal(generatedPlanSchema.safeParse(bad).success, false);
  assert.equal(profileSchema.safeParse({ firstName: "Mary", birthYear: 9999, hometown: "Columbus", knownFavorites: [], topicsToAvoid: [], otherTopicsToAvoid: "" }).success, false);
});

test("provider schema keeps required fields and verdict choices without decoding limits", () => {
  const full = { type: "object", required: ["items"], properties: { items: { type: "array", maxItems: 72, items: { type: "string", enum: ["ok", "caution", "exclude"], maxLength: 100, pattern: "complex" } } } };
  const result = simplifyModelSchema(full);
  assert.deepEqual(result.required, ["items"]);
  assert.deepEqual(result.properties.items.items.enum, ["ok", "caution", "exclude"]);
  assert.equal("maxItems" in result.properties.items, false);
  assert.equal("pattern" in result.properties.items.items, false);
  assert.equal(full.properties.items.maxItems, 72);
});
