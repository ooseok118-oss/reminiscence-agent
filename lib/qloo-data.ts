import type { FavoriteType } from "./profile";
import type { Contribution, QlooItem, Seed } from "./qloo-types";

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function year(value: unknown): number | null {
  const parsed = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : number(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 3000 ? parsed : null;
}

export function selectSeed(results: unknown[], type: FavoriteType): Seed | null {
  const matches = results.map(record).filter((item) =>
    Array.isArray(item.types) && item.types.includes(`urn:entity:${type}`)
    && typeof item.entity_id === "string" && typeof item.name === "string",
  );
  matches.sort((a, b) => (number(b.popularity) ?? -1) - (number(a.popularity) ?? -1));
  const item = matches[0];
  return item ? {
    entity_id: item.entity_id as string,
    name: item.name as string,
    type,
    popularity: number(item.popularity),
    release_year: year(record(item.properties).release_year),
  } : null;
}

export function overlapsEra(start: number | null, end: number | null, from: number, to: number) {
  // Missing end_year means ongoing; missing start_year cannot establish an overlap.
  return start !== null && start <= to && (end === null || end >= from) && (end === null || end >= start);
}

export function explanation(contributions: Contribution[]): string | null {
  if (!contributions.length) return null;
  const [first, second, ...rest] = [...contributions].sort((a, b) => b.score - a.score);
  // Something they enjoyed in an earlier session, pulling about as hard as anything else:
  // the clearest sign the plan learned from them, so it is named first.
  const learned = contributions.find((item) => item.origin === "session" && item.score >= first.score * 0.9);
  if (learned) return `Because they enjoyed ${learned.name} in an earlier session`;
  // One favorite: say what the taste graph found, not just the source.
  if (!second) return `People who love ${first.name} often love this too`;
  // One favorite "leads" when it clearly outweighs the next (0.58 vs 0.42 with two favorites).
  if (first.score - second.score >= 0.16) {
    return rest.length ? `Mostly inspired by ${first.name}` : `Mostly inspired by ${first.name}, with a touch of ${second.name}`;
  }
  return rest.length ? `Inspired most by ${first.name} and ${second.name}` : `Inspired by both ${first.name} and ${second.name}`;
}

export function normalizeItem(raw: unknown, type: FavoriteType, seeds: Seed[], queryWarning: boolean): QlooItem | null {
  const item = record(raw);
  if (typeof item.name !== "string" || typeof item.entity_id !== "string" || item.subtype !== `urn:entity:${type}`) return null;
  const props = record(item.properties);
  const explainability = record(record(item.query).explainability);
  const signal = explainability["signal.interests.entities"];
  const because_of: Contribution[] = [];
  if (!queryWarning && !explainability.warning && !record(signal).warning && Array.isArray(signal)) {
    for (const rawContribution of signal) {
      const contribution = record(rawContribution);
      const seed = seeds.find((seed) => seed.entity_id.toUpperCase() === String(contribution.entity_id).toUpperCase());
      const score = number(contribution.score);
      if (seed && score !== null && score >= 0 && score <= 1 && !because_of.some((item) => item.entity_id === seed.entity_id)) {
        because_of.push({ entity_id: seed.entity_id, name: seed.name, score, origin: seed.origin });
      }
    }
  }
  because_of.sort((a, b) => b.score - a.score);
  return {
    entity_id: item.entity_id, name: item.name, type,
    release_year: year(props.release_year), start_year: year(props.start_year), end_year: year(props.end_year),
    description: typeof props.short_description === "string" ? props.short_description.slice(0, 600)
      : typeof props.description === "string" ? props.description.slice(0, 600) : "",
    popularity: number(item.popularity), because_of, why_this: explanation(because_of),
  };
}
