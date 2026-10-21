# Reminiscence Agent

A conversation aid for caregivers and families, inspired by familiar favorites.

Live demo: https://reminiscence-agent.vercel.app

## Status: Step 4 — Gemini review and planning

Choose **Try an example**, then **Build a gentle session**. The app resolves
Elvis Presley and Roman Holiday, expands to movies/TV/music with Qloo, screens
all candidates, and prints the safety decisions plus the session plan JSON.

Screening has three outcomes: `exclude` (set aside), `caution` (use only the
provided positive safe angles), and `ok` (no concern flagged). Explicit caregiver
topics take precedence. The interface shows how many items were set aside and why.
Model screening is a judgment, not a guarantee; caregivers should review the plan.
Original Qloo data remains available in a collapsed source-data section.

Gemini `gemini-3.5-flash-lite` is called directly using the Google AI Studio key through
the Vercel AI SDK Google provider. All UI text and generated plans are English.
Designing the final timeline interface belongs to Step 5.

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

Fill in `QLOO_API_KEY` in `.env.local`. Also fill in `GEMINI_API_KEY` from Google AI Studio for Step 4.
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
The profile, topics to avoid, and Qloo candidates are sent to Gemini by the server only after submission. Profiles and model responses are not logged or persisted by the app.

## Gemini route and validation

`POST /api/plan` has two actions so the progress display reflects real work:

- `review`: receives the profile and a signed Qloo expansion receipt, screens every
  item, and returns all verdicts/reasons/safe angles plus a signed reviewed pool.
- `generate`: accepts that reviewed receipt and sends only non-excluded items to
  Gemini. Returns the requested `opening_song`, `conversation`, `sensory_activity`,
  and `closing` JSON. The intended durations are 5 + 15 + 5 + 5 minutes.

Receipts expire after 30 minutes and bind the approved pool and profile. Modified,
unsigned, expired, or unreviewed inputs are rejected. HMACs use existing server
secrets with separate purposes. No receipt appears in a URL or log.

Structured output is checked with Zod. Malformed JSON, missing review coverage,
invalid IDs, excluded/invented plan items, unapproved caution angles, long prompts,
quizzes, and explicit forbidden phrases cannot pass validation. An invalid output
gets one regeneration; a second failure releases no plan. These mechanical
checks support the contextual model review, and do not prove semantic safety.
Attribution comes from Qloo metadata, rather than the model's invented claims.

If exclusion leaves fewer than three candidates in a category, bounded refill
rounds first lower popularity, then widen years by five. Every new admitted item
is screened again. Time/coverage limits are reported and never relax safety rules.
The two route actions each use `maxDuration=60` and bounded upstream deadlines.

Qloo currently supplies artist names rather than verified recordings. The opening
therefore selects an approved artist and invites a familiar recording; no song
title, lyrics, or playback link is invented. Caution items carry safe angles into
the planning prompt. The final UI prints the plan JSON without rendering model HTML.

## Environment variables and deployment

`QLOO_API_KEY` is read only by the server module protected with `server-only`.
All Qloo requests use `https://hackathon.api.qloo.com` and the `X-Api-Key` header.
The browser calls only this app's routes. Both Qloo and Gemini keys, upstream response bodies, and
profiles are not logged. Failure logs identify stage, category, and HTTP status.

In Vercel's project settings, register `QLOO_API_KEY` and `GEMINI_API_KEY` as Secrets for Production
and Preview **before a new deployment**. Environment changes require redeploying.
Use Node.js 24.x and the default Next.js build settings. The existing project is
already linked to GitHub. Keep generated preview deployments protected; the
canonical production demo URL is public.

Never commit `.env.local` or real credentials. `.env.example` contains empty
`QLOO_API_KEY` and `GEMINI_API_KEY` entries only. Never use `NEXT_PUBLIC_` for keys.

## Checks

Run focused tests for Qloo matching, era overlap, explainability, review coverage,
approved-item grounding, safe angles, and read-aloud constraints:

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
