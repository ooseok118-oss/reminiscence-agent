import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVerdicts, validatePlan, planRequirements, generatedPlanSchema, profileSchema } from "../lib/plan-schema.ts";
import { simplifyModelSchema } from "../lib/model-schema.ts";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const make = (n, name, type, extra = {}) => ({ entity_id: id(n), name, type, why_this: `Inspired by seed ${n}`, verdict: "ok", safe_angles: [], ...extra });
const sinatra = make(1, "Frank Sinatra", "artist");
const cole = make(2, "Nat King Cole", "artist");
const armstrong = make(3, "Louis Armstrong", "artist");
const fairLady = make(4, "My Fair Lady", "movie");
const westSide = make(5, "West Side Story", "movie", { verdict: "caution", safe_angles: ["The dancing", "The costumes"] });
const happyDays = make(6, "Happy Days", "tv_show");
const waltons = make(7, "The Waltons", "tv_show");
const cabaret = make(8, "Cabaret", "movie", { verdict: "exclude", why_this: null });
const items = [sinatra, cole, armstrong, fairLady, westSide, happyDays, waltons, cabaret];

const entry = (item, extra) => ({ entity_id: item.entity_id, item: item.name, safe_angle: item.safe_angles[0] ?? "", ...extra });
const questions = (topic) => [`What do you enjoy about ${topic}?`, `Who did you share it with?`, `Where did you hear it?`];
function plan() {
  return {
    opening_song: entry(sinatra, { songs: ["Fly Me to the Moon"], caregiver_tip: "Offer a familiar recording, with the choice to listen quietly." }),
    conversation: [
      entry(westSide, { prompts: ["What do you enjoy about the dancing in West Side Story?", "How do the bright skirts make you feel?", "Who did you go dancing with?"] }),
      entry(happyDays, { prompts: questions("Happy Days") }),
      entry(armstrong, { prompts: questions("Louis Armstrong’s trumpet") }),
    ],
    sensory_activity: entry(fairLady, { activity: "Look at photos of elegant hats together and try one on.", materials: ["Printed photos", "A hat"] }),
    closing: entry(cole, { songs: [], caregiver_tip: "Offer quiet listening, or a pause if that feels better." }),
  };
}

test("review coverage rejects omissions, duplicates and unknown IDs", () => {
  const small = [sinatra, westSide, cabaret];
  const verdicts = small.map(({ entity_id, verdict, safe_angles }) => ({ entity_id, verdict, safe_angles, reason: "Reviewed" }));
  assert.equal(validateVerdicts(verdicts, small).length, 3);
  assert.throws(() => validateVerdicts(verdicts.slice(1), small), /every item/);
  assert.throws(() => validateVerdicts([verdicts[0], verdicts[0], verdicts[2]], small), /every item/);
  assert.throws(() => validateVerdicts([{ ...verdicts[0], entity_id: "unknown" }, ...verdicts.slice(1)], small), /every item/);
  assert.throws(() => validateVerdicts([verdicts[0], { ...verdicts[1], safe_angles: [] }, verdicts[2]], small), /safe angles/);
});

test("a full pool asks for a film, a TV show and an artist, all different", () => {
  const requirements = planRequirements(items);
  assert.deepEqual([...requirements.conversation_types].sort(), ["artist", "movie", "tv_show"]);
  assert.deepEqual(requirements.sensory_types, ["movie", "tv_show"]);
  assert.equal(requirements.all_distinct, true);
  assert.equal(requirements.distinct_music, true);
});

test("a valid plan keeps Qloo attribution, item types and the new fields", () => {
  const result = validatePlan(generatedPlanSchema.parse(plan()), items, ["War"]);
  assert.equal(result.opening_song.why_this, sinatra.why_this);
  assert.equal(result.opening_song.type, "artist");
  assert.deepEqual(result.opening_song.songs, ["Fly Me to the Moon"]);
  assert.equal(result.conversation.length, 3);
  assert.equal(result.conversation[0].why_this, westSide.why_this);
  assert.deepEqual(result.sensory_activity.materials, ["Printed photos", "A hat"]);
  assert.equal("entity_id" in result.opening_song, false);
  assert.equal("safe_angle" in result.conversation[0], false);
});

test("model-written attribution is ignored in favor of Qloo scores", () => {
  const generated = plan();
  generated.opening_song.why_this = "invented claim";
  const result = validatePlan(generatedPlanSchema.parse(generated), items, []);
  assert.equal(result.opening_song.why_this, sinatra.why_this);
});

test("excluded items, invented titles and unapproved caution angles cannot enter the plan", () => {
  let bad = plan(); bad.sensory_activity.entity_id = cabaret.entity_id; bad.sensory_activity.item = cabaret.name;
  assert.throws(() => validatePlan(bad, items, []), /approved Qloo pool/);
  bad = plan(); bad.opening_song.item = "A song invented by the model";
  assert.throws(() => validatePlan(bad, items, []), /approved Qloo pool/);
  bad = plan(); bad.conversation[0].safe_angle = "The violent plot";
  assert.throws(() => validatePlan(bad, items, []), /approved safe angle/);
});

test("the session shape is enforced when the pool can supply it", () => {
  let bad = plan(); bad.conversation.pop();
  assert.throws(() => validatePlan(bad, items, []), /one item of each type/);
  bad = plan(); bad.conversation[1] = entry(fairLady, { prompts: questions("the hats in My Fair Lady") });
  assert.throws(() => validatePlan(bad, items, []), /one item of each type/);
  bad = plan(); bad.closing = entry(sinatra, { songs: [], caregiver_tip: "Offer quiet listening." });
  assert.throws(() => validatePlan(bad, items, []), /different artists/);
  bad = plan(); bad.sensory_activity = entry(happyDays, { activity: "Look at photos of the diner set together.", materials: ["Printed photos"] });
  assert.throws(() => validatePlan(bad, items, []), /same item twice/);
  bad = plan(); bad.closing = entry(fairLady, { songs: [], caregiver_tip: "Offer quiet listening." });
  assert.throws(() => validatePlan(bad, items, []), /Closing needs a Qloo artist/);
});

test("a sparse pool relaxes only what it cannot supply", () => {
  const sparse = [sinatra, fairLady];
  const requirements = planRequirements(sparse);
  assert.deepEqual(requirements.conversation_types, ["movie"]);
  assert.equal(requirements.all_distinct, false);
  assert.equal(requirements.distinct_music, false);
  const small = {
    opening_song: entry(sinatra, { songs: [], caregiver_tip: "Offer a familiar recording." }),
    conversation: [entry(fairLady, { prompts: questions("the hats in My Fair Lady") })],
    sensory_activity: entry(fairLady, { activity: "Look at photos of elegant hats together.", materials: ["Printed photos"] }),
    closing: entry(sinatra, { songs: [], caregiver_tip: "Offer quiet listening." }),
  };
  assert.equal(validatePlan(generatedPlanSchema.parse(small), sparse, []).conversation.length, 1);
});

test("read-aloud text rejects quizzes, long prompts and avoided topics, including song titles", () => {
  let bad = plan(); bad.conversation[1].prompts[1] = "What year do you remember this coming out?";
  assert.throws(() => validatePlan(bad, items, []), /quiz/);
  bad = plan(); bad.conversation[1].prompts[1] = "What " + Array(24).fill("word").join(" ");
  assert.throws(() => validatePlan(bad, items, []), /under 25/);
  bad = plan(); bad.conversation[1].prompts[1] = "What did you enjoy about the war scenes?";
  assert.throws(() => validatePlan(bad, items, ["War"]), /topic to avoid/);
  bad = plan(); bad.closing.caregiver_tip = "Talk about hospitals.";
  assert.throws(() => validatePlan(bad, items, ["Hospitals"]), /topic to avoid/);
  bad = plan(); bad.opening_song.songs = ["Hospital Blues"];
  assert.throws(() => validatePlan(bad, items, ["Hospital Blues"]), /topic to avoid/);
  bad = plan(); bad.conversation[1].prompts[1] = "Would you like to talk about this?";
  assert.throws(() => validatePlan(bad, items, []), /What, How, Who or Where/);
  bad = plan(); bad.conversation[1].prompts[1] = "Who starred in this show?";
  assert.throws(() => validatePlan(bad, items, []), /quiz/);
});

test("the first question must name its item, allowing a dropped leading The and curly apostrophes", () => {
  let bad = plan(); bad.conversation[1].prompts[0] = "What trips near the water did you enjoy?";
  assert.throws(() => validatePlan(bad, items, []), /must name it/);
  const ok = plan(); ok.conversation[1].prompts[0] = "What did you enjoy about Happy Days on a Tuesday night?";
  assert.equal(validatePlan(generatedPlanSchema.parse(ok), items, []).conversation.length, 3);
  const curly = plan(); curly.conversation[0].prompts[0] = "What do you enjoy about the dancing in West Side Story’s big scenes?";
  assert.equal(validatePlan(generatedPlanSchema.parse(curly), items, []).conversation.length, 3);
});

test("malformed output and unbounded profiles fail schema validation", () => {
  assert.equal(generatedPlanSchema.safeParse({ conversation: [] }).success, false);
  let bad = plan(); bad.conversation[0].prompts.pop();
  assert.equal(generatedPlanSchema.safeParse(bad).success, false);
  bad = plan(); bad.opening_song.songs = ["One", "Two", "Three"];
  assert.equal(generatedPlanSchema.safeParse(bad).success, false);
  bad = plan(); bad.conversation.push(bad.conversation[0]);
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
