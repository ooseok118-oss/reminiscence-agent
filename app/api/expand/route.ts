import { errorResponse, expandCategory, expansionInput, readBody } from "@/lib/qloo-server";
import type { FavoriteType } from "@/lib/profile";
import type { Expansion } from "@/lib/qloo-types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { birthYear, seeds } = expansionInput(await readBody(request));
    const era = { from: birthYear + 10, to: birthYear + 30 };
    const categories = await Promise.all((["movie", "tv_show", "artist"] as FavoriteType[])
      .map((type) => expandCategory(type, seeds, era.from, era.to)));
    const result: Expansion = { seeds, era, categories, safety_reviewed: false };
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "expand"); }
}
