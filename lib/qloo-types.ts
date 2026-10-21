import type { FavoriteType } from "./profile";

export type Seed = {
  entity_id: string;
  name: string;
  type: FavoriteType;
  popularity: number | null;
  release_year: number | null;
};

export type Contribution = { entity_id: string; name: string; score: number };
export type QlooItem = {
  entity_id: string;
  name: string;
  type: FavoriteType;
  release_year: number | null;
  start_year: number | null;
  end_year: number | null;
  description: string;
  popularity: number | null;
  because_of: Contribution[];
  why_this: string | null;
};

export type CategoryResult = {
  type: FavoriteType;
  items: QlooItem[];
  filters: { from: number; to: number; popularity: number | null };
  attempts: number;
  warnings: string[];
  error: string | null;
};

export type Expansion = {
  proof?: string;
  seeds: Seed[];
  era: { from: number; to: number };
  categories: CategoryResult[];
  /** Entity IDs kept out of this search and any refill of it. */
  exclude?: string[];
  safety_reviewed: false;
};
