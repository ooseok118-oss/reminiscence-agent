import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVerdicts, validatePlan, planRequirements, leadWithItem, generatedPlanSchema, profileSchema } from "../lib/plan-schema.ts";
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
  assert.equal(result.opening_song.entity_id, sinatra.entity_id);   // kept so feedback can refer to it
  assert.equal("safe_angle" in result.conversation[0], false);
});

test("model-written attribution is ignored in favor of Qloo scores", () => {
  const generated = plan();
  generated.opening_song.why_this = "invented claim";
  const result = validatePlan(generatedPlanSchema.parse(generated), items, []);
  assert.equal(result.opening_song.why_this, sinatra.why_this);
});

test("excluded items, invented items and unapproved caution angles cannot enter the plan", () => {
  let bad = plan(); bad.sensory_activity.entity_id = cabaret.entity_id; bad.sensory_activity.item = cabaret.name;
  assert.throws(() => validatePlan(bad, items, []), /approved Qloo pool/);
  bad = plan(); bad.opening_song.entity_id = id(99); bad.opening_song.item = "A singer invented by the model";
  assert.throws(() => validatePlan(bad, items, []), /approved Qloo pool/);
  bad = plan(); bad.conversation[0].safe_angle = "The violent plot";
  assert.throws(() => validatePlan(bad, items, []), /approved safe angle/);
});

test("harmless formatting slips are repaired instead of discarding a safe plan", () => {
  const slips = plan();
  slips.opening_song.item = "frank sinatra";                       // case differs; the ID is authoritative
  slips.conversation[0].entity_id = "";                             // missing ID, name with curly quotes resolves
  slips.conversation[0].item = "West Side Story\u2019";
  slips.conversation[0].safe_angle = "the dancing.";                // punctuation and case differ
  slips.opening_song.songs = ["Fly Me to the Moon", "My Kind of Town", "A third song"];
  slips.sensory_activity.materials = ["Photos", "A hat", "A scarf", "A fan", "Gloves"];
  slips.conversation.push(entry(waltons, { prompts: questions("The Waltons") }));  // an extra topic is skipped
  slips.conversation[1].prompts.push("Can you tell me more?");      // an extra unsuitable question is dropped
  const result = validatePlan(generatedPlanSchema.parse(slips), items, []);
  assert.equal(result.opening_song.item, "Frank Sinatra");
  assert.equal(result.conversation[0].item, "West Side Story");
  assert.equal(result.conversation.length, 3);
  assert.deepEqual(result.conversation.map((topic) => topic.item).sort(), ["Happy Days", "Louis Armstrong", "West Side Story"]);
  assert.equal(result.conversation.find((topic) => topic.item === "Happy Days").prompts.length, 3);
  assert.equal(result.opening_song.songs.length, 2);
  assert.equal(result.sensory_activity.materials.length, 4);
});

test("the session shape is enforced when the pool can supply it", () => {
  let bad = plan(); bad.conversation.pop();
  assert.throws(() => validatePlan(bad, items, []), /one item of each type/);
  bad = plan(); bad.conversation[1] = entry(fairLady, { prompts: questions("the hats in My Fair Lady") });
  assert.throws(() => validatePlan(bad, items, []), /one item of each type/);
  const revisit = plan(); revisit.sensory_activity = entry(happyDays, { activity: "Look at photos of the Happy Days diner set together.", materials: ["Printed photos"] });
  assert.equal(validatePlan(generatedPlanSchema.parse(revisit), items, []).sensory_activity.item, "Happy Days");  // revisiting a topic is fine
  bad = plan(); bad.closing = entry(fairLady, { songs: [], caregiver_tip: "Offer quiet listening." });
  assert.throws(() => validatePlan(bad, items, []), /Closing needs a Qloo artist/);
});

test("a duplicated song slot gets another approved artist instead of failing the plan", () => {
  // Closing repeats the opening artist: the closing gets the unused artist, songs dropped, tip kept.
  let generated = plan(); generated.closing = entry(sinatra, { songs: ["My Way"], caregiver_tip: "Offer quiet listening." });
  let result = validatePlan(generatedPlanSchema.parse(generated), items, []);
  assert.equal(result.closing.item, "Nat King Cole");
  assert.deepEqual(result.closing.songs, []);
  assert.equal(result.closing.caregiver_tip, "Offer quiet listening.");
  // Opening repeats the conversation artist and names him in the tip: both are replaced.
  generated = plan(); generated.opening_song = entry(armstrong, { songs: ["What a Wonderful World"], caregiver_tip: "Play Louis Armstrong softly." });
  result = validatePlan(generatedPlanSchema.parse(generated), items, []);
  assert.equal(result.opening_song.item, "Frank Sinatra");
  assert.deepEqual(result.opening_song.songs, []);
  assert.doesNotMatch(result.opening_song.caregiver_tip, /Armstrong/);
  assert.ok(result.conversation.some((topic) => topic.item === "Louis Armstrong"));      // the questions survive
  const names = [result.opening_song.item, ...result.conversation.map((topic) => topic.item), result.closing.item];
  assert.equal(new Set(names).size, names.length);
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

test("read-aloud text rejects quizzes, long prompts and avoided topics", () => {
  let bad = plan(); bad.conversation[1].prompts[1] = "What year do you remember this coming out?";
  assert.throws(() => validatePlan(bad, items, []), /quiz/);
  bad = plan(); bad.conversation[1].prompts[1] = "What " + Array(24).fill("word").join(" ");
  assert.throws(() => validatePlan(bad, items, []), /under 25/);
  bad = plan(); bad.conversation[1].prompts[1] = "What did you enjoy about the war scenes?";
  assert.throws(() => validatePlan(bad, items, ["War"]), /topic to avoid/);
  bad = plan(); bad.closing.caregiver_tip = "Talk about hospitals.";
  assert.throws(() => validatePlan(bad, items, ["Hospitals"]), /topic to avoid/);
  bad = plan(); bad.sensory_activity.activity = "Do you remember the dance steps?";
  assert.throws(() => validatePlan(bad, items, []), /quiz/);
  bad = plan(); bad.conversation[1].prompts[1] = "Would you like to talk about this?";
  assert.throws(() => validatePlan(bad, items, []), /What, How, Who or Where/);
  bad = plan(); bad.conversation[1].prompts[1] = "Who starred in this show?";
  assert.throws(() => validatePlan(bad, items, []), /quiz/);
});

test("a song or material touching an avoided topic is dropped, never shown", () => {
  const generated = plan(); generated.opening_song.songs = ["Hospital Blues", "Fly Me to the Moon"];
  generated.sensory_activity.materials = ["Hospital bracelet", "A hat"];
  const result = validatePlan(generatedPlanSchema.parse(generated), items, ["Hospital"]);
  assert.deepEqual(result.opening_song.songs, ["Fly Me to the Moon"]);
  assert.deepEqual(result.sensory_activity.materials, ["A hat"]);
});

test("a question naming the item moves to the front; plans without one are kept, not discarded", () => {
  const moved = plan(); moved.conversation[1].prompts = ["Where did you watch it?", "What did you enjoy about Happy Days on a Tuesday night?", "Who watched with you?"];
  assert.equal(validatePlan(generatedPlanSchema.parse(moved), items, []).conversation[1].prompts[0], "What did you enjoy about Happy Days on a Tuesday night?");
  const unnamed = plan(); unnamed.conversation[1].prompts[0] = "What trips near the water did you enjoy?";
  assert.equal(validatePlan(generatedPlanSchema.parse(unnamed), items, []).conversation[1].prompts[0], "What trips near the water did you enjoy?");
  assert.deepEqual(leadWithItem("The Love Boat", ["Who came along?", "What did you like about Love Boat\u2019s cruises?"]), ["What did you like about Love Boat\u2019s cruises?", "Who came along?"]);
});

test("warm Who questions stay allowed; asking to name titles is dropped", () => {
  const generated = plan();
  generated.conversation[2].prompts = ["What do you enjoy about Louis Armstrong’s trumpet?", "What songs did you sing along with?", "Who sang along with you at parties?", "Where did you hear him play?"];
  const prompts = validatePlan(generatedPlanSchema.parse(generated), items, []).conversation.find((topic) => topic.item === "Louis Armstrong").prompts;
  assert.deepEqual(prompts, ["What do you enjoy about Louis Armstrong’s trumpet?", "Who sang along with you at parties?", "Where did you hear him play?"]);
});

test("on the last attempt, unusable slots are filled from the approved pool with plain wording", () => {
  const broken = plan();
  broken.opening_song.entity_id = id(99); broken.opening_song.item = "Invented singer";
  broken.conversation.splice(1, 1);                                        // TV topic missing
  broken.sensory_activity.entity_id = cabaret.entity_id;                  // excluded item
  broken.closing.caregiver_tip = "Do you remember this song?";             // quiz in a tip
  assert.throws(() => validatePlan(generatedPlanSchema.parse(broken), items, []));
  const result = validatePlan(generatedPlanSchema.parse(broken), items, [], { fallback: true });
  const names = [result.opening_song.item, ...result.conversation.map((topic) => topic.item), result.sensory_activity.item, result.closing.item];
  assert.equal(new Set(names).size, names.length);                        // still six different items
  assert.equal(result.opening_song.type, "artist");
  assert.deepEqual(result.conversation.map((topic) => topic.type).sort(), ["artist", "movie", "tv_show"]);
  assert.ok(!names.includes("Cabaret"));
  assert.notEqual(result.sensory_activity.item, "West Side Story");        // caution items never get plain wording
  assert.match(result.closing.caregiver_tip, /calm/);
  const tv = result.conversation.find((topic) => topic.type === "tv_show");
  assert.equal(tv.prompts.length, 3);
  assert.match(tv.prompts[0], new RegExp(tv.item));
});

test("the fallback still refuses when no approved item can fill a slot", () => {
  const onlyFilms = [fairLady, cabaret];
  const generated = { opening_song: entry(fairLady, { songs: [], caregiver_tip: "Offer quiet listening." }), conversation: [entry(fairLady, { prompts: questions("My Fair Lady") })], sensory_activity: entry(fairLady, { activity: "Look at photos of hats.", materials: [] }), closing: entry(fairLady, { songs: [], caregiver_tip: "Offer quiet listening." }) };
  assert.throws(() => validatePlan(generatedPlanSchema.parse(generated), onlyFilms, [], { fallback: true }), /Not enough approved Qloo items/);
});

test("too few usable questions, malformed output and unbounded profiles still fail", () => {
  assert.equal(generatedPlanSchema.safeParse({ conversation: [] }).success, false);
  const short = plan(); short.conversation[1].prompts.pop();
  assert.throws(() => validatePlan(generatedPlanSchema.parse(short), items, []), /three questions/);
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



test("review retries explicit verdict contradictions without promoting excluded items", () => {
  const item = make(20, "Taxi", "tv_show");
  const decision = { entity_id: item.entity_id, verdict: "exclude", safe_angles: [], reason: "This is a 1970s sitcom, not a 1950s sitcom. Verdict ok." };
  assert.throws(() => validateVerdicts([decision], [item]), /reason must agree/);
  assert.throws(() => validateVerdicts([{ ...decision, reason: "Verdict: caution." }], [item]), /reason must agree/);
  assert.equal(validateVerdicts([{ ...decision, reason: "Its central subject is a topic to avoid." }], [item])[0].verdict, "exclude");
  assert.equal(validateVerdicts([{ ...decision, verdict: "ok", reason: "Verdict is ok." }], [item])[0].verdict, "ok");
});
