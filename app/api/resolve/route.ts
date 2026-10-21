import { errorResponse, favoritesInput, readBody, resolveFavorite } from "@/lib/qloo-server";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const favorites = favoritesInput(body.knownFavorites);
    const matches = await Promise.all(favorites.map(resolveFavorite));
    const seeds = [...new Map(matches.map((seed) => [seed.entity_id, seed])).values()];
    return Response.json({ seeds }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "resolve"); }
}
