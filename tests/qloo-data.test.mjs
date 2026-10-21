import { test } from "node:test";
import assert from "node:assert/strict";
import { selectSeed, overlapsEra, normalizeItem, explanation } from "../lib/qloo-data.ts";

const seeds = [
  { entity_id: "A", name: "Roman Holiday", type: "movie", popularity: 0.989, release_year: 1953 },
  { entity_id: "B", name: "Elvis Presley", type: "artist", popularity: 0.9, release_year: null },
];

test("ambiguous titles resolve by chosen type, then descending popularity", () => {
  const results = [
    { entity_id: "hotel", name: "Roman Holiday", types: ["urn:entity:place"], popularity: 1 },
    { entity_id: "singer", name: "Roman Holiday", types: ["urn:entity:artist"], popularity: 0.99 },
    { entity_id: "remake", name: "Roman Holiday", types: ["urn:entity:movie"], popularity: 0.7, properties: { release_year: 1987 } },
    { entity_id: "original", name: "Roman Holiday", types: ["urn:entity:movie"], popularity: 0.989, properties: { release_year: 1953 } },
  ];
  assert.equal(selectSeed(results, "movie").release_year, 1953);
  assert.equal(selectSeed(results, "artist").entity_id, "singer");
  assert.equal(selectSeed(results, "tv_show"), null);
});

test("artist activity must overlap the era; missing end means ongoing", () => {
  assert.equal(overlapsEra(1958, 1978, 1958, 1978), true);
  assert.equal(overlapsEra(1935, 1958, 1958, 1978), true);
  assert.equal(overlapsEra(1978, null, 1958, 1978), true);
  assert.equal(overlapsEra(1979, null, 1958, 1978), false);
  assert.equal(overlapsEra(1900, 1957, 1958, 1978), false);
  assert.equal(overlapsEra(null, null, 1958, 1978), false);
  assert.equal(overlapsEra(1960, 1950, 1958, 1978), false);
});

test("explanations preserve source identity and raw scores, with no invented scores", () => {
  const raw = {
    entity_id: "C", name: "Breakfast at Tiffany's", subtype: "urn:entity:movie", properties: { release_year: 1961 },
    query: { explainability: { "signal.interests.entities": [
      { entity_id: "B", score: 0.4060941366 }, { entity_id: "A", score: 0.5939058634 },
      { entity_id: "unrelated", score: 1 },
    ] } },
  };
  const item = normalizeItem(raw, "movie", seeds, false);
  assert.equal(item.because_of.length, 2);
  assert.equal(item.because_of[0].score, 0.5939058634);
  assert.equal(item.why_this, "Mostly inspired by Roman Holiday, with a touch of Elvis Presley");
  assert.deepEqual(normalizeItem(raw, "movie", seeds, true).because_of, []);
  assert.equal(normalizeItem({ ...raw, query: {} }, "movie", seeds, false).why_this, null);
  raw.query.explainability.warning = "insufficient data";
  assert.equal(normalizeItem(raw, "movie", seeds, false).why_this, null);
  assert.equal(explanation([{ ...seeds[0], score: 0.57 }, { ...seeds[1], score: 0.43 }]), "Inspired by both Roman Holiday and Elvis Presley");
  assert.equal(normalizeItem(raw, "tv_show", seeds, false), null);
  const third = { entity_id: "C", name: "Casablanca", type: "movie", popularity: 0.99, release_year: 1942 };
  assert.equal(explanation([{ ...seeds[1], score: 0.35 }, { ...seeds[0], score: 0.33 }, { ...third, score: 0.32 }]), "Inspired most by Elvis Presley and Roman Holiday");
  assert.equal(explanation([{ ...seeds[1], score: 0.55 }, { ...seeds[0], score: 0.25 }, { ...third, score: 0.2 }]), "Mostly inspired by Elvis Presley");
  const learned = { entity_id: "D", name: "Louis Armstrong", score: 0.24, origin: "session" };
  assert.equal(explanation([{ ...seeds[1], score: 0.26 }, learned, { ...seeds[0], score: 0.25 }, { ...third, score: 0.25 }]), "Because they enjoyed Louis Armstrong in an earlier session");
  assert.equal(explanation([{ ...seeds[1], score: 0.6 }, { ...learned, score: 0.2 }, { ...seeds[0], score: 0.2 }]), "Mostly inspired by Elvis Presley");
  assert.equal(explanation([{ ...seeds[0], score: 1 }]), "People who love Roman Holiday often love this too");
});
