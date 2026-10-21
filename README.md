# Reminiscence Agent

A conversation aid for caregivers and families, inspired by familiar favorites.

Live demo: https://reminiscence-agent.vercel.app

## Status: Step 3 — Qloo connections

Choose **Try an example**, then **Find familiar connections**. The app resolves
Elvis Presley (Singer) and Roman Holiday (Movie), then displays movies, TV shows,
and music with Qloo's contribution scores for each starting favorite.
Recognized matches are shown above the results. Edit a name or type and submit
again to change a match. Profiles are not stored or printed to the console.

**These are raw results for data review. Safety screening and topics to avoid
are not applied yet. Gemini session planning belongs to the next step.**

## Stack

Next.js App Router, TypeScript, React, Tailwind CSS, Node.js 24, Vercel.
Production deploys automatically from this repository's main branch.

## Run locally

Install the locked dependencies:

```bash
npm ci
```

Copy the blank environment template:

```bash
cp .env.example .env.local
```

Fill in `QLOO_API_KEY` in `.env.local`. A Gemini key is not required for Step 3.
Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## API flow

1. `POST /api/resolve` receives `{ knownFavorites: [{ type, name }] }`, searches
   each favorite in parallel, filters by the selected Qloo type, and chooses
   the highest popularity match. Singer → `artist`, Movie → `movie`,
   TV show → `tv_show`. Returns `{ seeds }`. An unmatched favorite gives a
   clear error rather than silently replacing the user's starting point.
2. `POST /api/expand` receives `{ birthYear, seeds }`. All seed IDs are sent
   together to three parallel `/v2/insights` calls with `take=12` and
   `feature.explainability=true`.

| Category | Era filter | Initial popularity minimum |
| --- | --- | --- |
| Movies | Release year: birth year +10 through +30 | 0.8 |
| TV shows | Release year: birth year +10 through +30 | 0.5 |
| Music | Local activity-year overlap; no unsupported API year filter | None |

An artist without an end year is treated as ongoing. An artist without a start
year cannot establish an overlap and is excluded. No tags are imposed. If fewer
than three results remain, movie/TV popularity is lowered to 0.5/0.2, followed by
an era expansion of five years on each side. Music rechecks its returned artists
against the wider era. Applied filters and any partial failures are visible.
Requests have bounded upstream timeouts and routes use `maxDuration=60`.
A failed category preserves the other categories and can be retried by submitting
again.

Each item contains `because_of: [{ entity_id, name, score }]`. Scores are
preserved without renormalizing or turning them into percentages. Explanations
are omitted when missing or accompanied by a Qloo warning. A highest contribution
of at least 0.58 gets “Mostly inspired by…” wording; otherwise both/all provided
sources are named.

Only favorite names/types go to resolve; expand additionally receives birth year.
The person's name, hometown, and topics to avoid stay in the browser in this step.

## Environment variables and deployment

`QLOO_API_KEY` is read only by the server module protected with `server-only`.
All Qloo requests use `https://hackathon.api.qloo.com` and the `X-Api-Key` header.
The browser calls only this app's routes. Keys, upstream response bodies, and
profiles are not logged. Failure logs identify stage, category, and HTTP status.

In Vercel's project settings, register `QLOO_API_KEY` as a Secret for Production
and Preview **before a new deployment**. Environment changes require redeploying.
Use Node.js 24.x and the default Next.js build settings. The existing project is
already linked to GitHub. Keep generated preview deployments protected; the
canonical production demo URL is public.

Never commit `.env.local` or real credentials. `.env.example` contains empty
`QLOO_API_KEY` and `GEMINI_API_KEY` entries only. Never use `NEXT_PUBLIC_` for keys.

## Checks

Run focused tests for ambiguous-title resolution, artist-era overlap, and
explainability handling:

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

Check TypeScript:

```bash
npm run typecheck
```

Build for production:

```bash
npm run build
```

## License

MIT. See [LICENSE](LICENSE).

A conversation aid, not medical advice.
