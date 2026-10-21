import "server-only";

import type { FavoriteType, KnownFavorite } from "./profile";
import type { CategoryResult, Seed } from "./qloo-types";
import { normalizeItem, overlapsEra, record, selectSeed } from "./qloo-data";

const BASE_URL = "https://hackathon.api.qloo.com";
const TYPES: FavoriteType[] = ["movie", "tv_show", "artist"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class QlooError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function readBody(request: Request, limit = 12_000): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new QlooError("Please send an application/json request.", 415);
  }
  // Bound the actual stream, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new QlooError("Please send a JSON request.", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new QlooError("Request is too large.", 413); }
    chunks.push(chunk.value);
  }
  try {
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    return record(JSON.parse(new TextDecoder().decode(buffer)));
  } catch { throw new QlooError("Please send valid JSON.", 400); }
}

export function favoritesInput(value: unknown): KnownFavorite[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new QlooError("Add 1–3 favorites.", 400);
  return value.map((raw) => {
    const item = record(raw);
    if (!TYPES.includes(item.type as FavoriteType) || typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 120) {
      throw new QlooError("Each favorite needs a valid type and a name of 1–120 characters.", 400);
    }
    return { type: item.type as FavoriteType, name: item.name.trim() };
  });
}

export function expansionInput(body: Record<string, unknown>): { birthYear: number; seeds: Seed[] } {
  if (!Number.isInteger(body.birthYear) || Number(body.birthYear) < 1900 || Number(body.birthYear) > new Date().getFullYear()) {
    throw new QlooError("Enter a valid birth year.", 400);
  }
  if (!Array.isArray(body.seeds) || body.seeds.length < 1 || body.seeds.length > 4) throw new QlooError("Resolve 1–3 favorites first.", 400);
  const seeds = body.seeds.map((raw) => {
    const item = record(raw);
    if (typeof item.entity_id !== "string" || !UUID.test(item.entity_id)
      || typeof item.name !== "string" || !item.name.trim() || item.name.length > 240 || !TYPES.includes(item.type as FavoriteType)) {
      throw new QlooError("Invalid resolved favorite. Please search again.", 400);
    }
    return { entity_id: item.entity_id.toUpperCase(), name: item.name.trim(), type: item.type as FavoriteType,
      popularity: null, release_year: null } satisfies Seed;
  });
  return { birthYear: body.birthYear as number, seeds: [...new Map(seeds.map((seed) => [seed.entity_id, seed])).values()] };
}

async function qloo(path: string, params: URLSearchParams, stage: string, timeout = 22_000): Promise<Record<string, unknown>> {
  const key = process.env.QLOO_API_KEY;
  if (!key) {
    console.error("Qloo request failed", { stage, reason: "missing_server_environment" });
    throw new QlooError("Qloo is not configured on the server. Please contact the site owner.", 503);
  }
  try {
    const response = await fetch(`${BASE_URL}${path}?${params}`, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(Math.max(1, timeout)),
    });
    if (!response.ok) {
      console.error("Qloo request failed", { stage, status: response.status });
      throw new QlooError(response.status === 429 ? "Qloo is busy. Please wait a moment and try again." : "Qloo could not complete this request. Please try again.", response.status === 429 ? 429 : 502);
    }
    const data = record(await response.json());
    if (data.success === false) throw new QlooError("Qloo returned an unsuccessful response. Please try again.");
    return data;
  } catch (error) {
    if (error instanceof QlooError) throw error;
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    console.error("Qloo request failed", { stage, reason: timeout ? "timeout" : "network_or_invalid_response" });
    throw new QlooError(timeout ? "Qloo took too long. Please try again." : "Unable to reach Qloo. Please try again.", timeout ? 504 : 502);
  }
}

export async function resolveFavorite(favorite: KnownFavorite): Promise<Seed> {
  const data = await qloo("/search", new URLSearchParams({ query: favorite.name }), `resolve:${favorite.type}`);
  if (!Array.isArray(data.results)) throw new QlooError("Qloo search returned an unexpected response.");
  const seed = selectSeed(data.results, favorite.type);
  if (!seed) throw new QlooError(`No ${favorite.type === "artist" ? "singer" : favorite.type === "movie" ? "movie" : "TV show"} match for “${favorite.name}”. Check the name or type.`, 422);
  return seed;
}

// `exclude` keeps items out of the results: things already used, or that seemed to upset the person.
export async function expandCategory(type: FavoriteType, seeds: Seed[], from: number, to: number, relax = false, deadlineAt?: number, exclude: string[] = []): Promise<CategoryResult> {
  const excluded = new Set(exclude.map((id) => id.toUpperCase()));
  const result: CategoryResult = { type, items: [], filters: { from, to, popularity: type === "movie" ? (relax ? 0.5 : 0.8) : type === "tv_show" ? (relax ? 0.2 : 0.5) : null }, attempts: 0, warnings: [], error: null };
  const deadline = Math.min(Date.now() + 52_000, deadlineAt ?? Infinity);
  let artistEntities: unknown[] | null = null;
  let queryWarning = false;
  // No tags are imposed. Lower popularity, then widen the era only if needed.
  const attempts = relax ? ["initial"] : type === "artist" ? ["initial", "widen"] : ["initial", "popularity", "widen"];
  for (const attempt of attempts) {
    const previousFilters = { ...result.filters };
    if (attempt === "popularity") result.filters.popularity = type === "movie" ? 0.5 : 0.2;
    if (attempt === "widen") { result.filters.from = from - 5; result.filters.to = to + 5; }
    result.attempts++;
    try {
      let entities: unknown[];
      if (artistEntities) entities = artistEntities;
      else {
        const params = new URLSearchParams({ "filter.type": `urn:entity:${type}`, "signal.interests.entities": seeds.map((seed) => seed.entity_id).join(","), take: "12", "feature.explainability": "true" });
        if (excluded.size) params.set("filter.exclude.entities", [...excluded].join(","));
        if (type !== "artist") {
          params.set("filter.release_year.min", String(result.filters.from));
          params.set("filter.release_year.max", String(result.filters.to));
          params.set("filter.popularity.min", String(result.filters.popularity));
        }
        const remaining = deadline - Date.now();
        if (remaining < 1000) throw new QlooError("Qloo took too long. Please try again.", 504);
        const data = await qloo("/v2/insights", params, `expand:${type}:${attempt}`, Math.min(22_000, remaining));
        const results = record(data.results);
        if (!Array.isArray(results.entities)) throw new QlooError("Qloo insights returned an unexpected response.");
        entities = results.entities;
        queryWarning = Boolean(record(record(data.query).explainability).warning || record(record(results.query).explainability).warning);
        if (type === "artist") artistEntities = entities;
      }
      // Excluded IDs are also filtered here, in case the API returns them anyway.
      const items = entities.map((raw) => normalizeItem(raw, type, seeds, queryWarning))
        .filter((item) => item !== null)
        .filter((item) => !excluded.has(item.entity_id.toUpperCase()) && !seeds.some((seed) => seed.entity_id.toUpperCase() === item.entity_id.toUpperCase()));
      const filtered = items.filter((item) => type === "artist"
        ? overlapsEra(item.start_year, item.end_year, result.filters.from, result.filters.to)
        : item.release_year !== null && item.release_year >= result.filters.from && item.release_year <= result.filters.to
          && item.popularity !== null && item.popularity >= (result.filters.popularity ?? 0));
      result.items = [...new Map(filtered.map((item) => [item.entity_id, item])).values()];
      if (type === "artist" && attempt === "initial" && filtered.length < items.length) {
        result.warnings.push(`${items.length - filtered.length} artist(s) excluded because activity years did not establish an overlap.`);
      }
      if (result.items.length >= 3) break;
    } catch (error) {
      // Keep earlier partial results paired with the filters that produced them.
      if (result.items.length) result.filters = previousFilters;
      console.error("Qloo category failed", { stage: "expand", category: type, attempt, status: error instanceof QlooError ? error.status : 500 });
      result.error = error instanceof QlooError ? error.message : "This category could not be loaded. Please try again.";
      break;
    }
  }
  if (result.attempts > 1) result.warnings.push("Filters were relaxed because fewer than three results were available. The applied filters are shown below.");
  if (!result.error && result.items.length < 3) result.warnings.push("Fewer than three results remain after the available filter relaxations.");
  if (result.items.some((item) => !item.because_of.length)) result.warnings.push("Qloo did not provide reliable contribution scores for every item; unavailable explanations are omitted.");
  return result;
}

export function errorResponse(error: unknown, stage: string) {
  const status = error instanceof QlooError ? error.status : 500;
  console.error("Qloo route failed", { stage, status });
  return Response.json({ error: error instanceof QlooError ? error.message : "Something went wrong. Please try again." }, { status, headers: { "Cache-Control": "no-store" } });
}
