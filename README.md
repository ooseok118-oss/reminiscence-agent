# Reminiscence Agent

A conversation aid for caregivers and families, inspired by familiar favorites.

## Status

Step 2: an English caregiver profile form with a one-click example, typed favorites, and topics to avoid.

Live demo: https://reminiscence-agent.vercel.app

Production is connected to the main branch of this GitHub repository.
The form accepts a first name or nickname, birth year, hometown, 1–3 favorites,
and optional topics to avoid. Every favorite has a Singer / Movie / TV show selector.
Submitting validates the form and prints a typed profile to the browser console
with the label `Reminiscence Agent profile`. It does not call a planning API or
persist the profile. Qloo/Gemini integration will be added in later steps.

## Stack

- Next.js App Router, TypeScript, and Tailwind CSS
- Node.js 24 LTS and npm
- Planned hosting: Vercel

## Run locally

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run build
```

## Environment variables

The profile form builds and runs without API keys.
When integrations are added, create `.env.local` using `.env.example` and fill
in `QLOO_API_KEY` and `GEMINI_API_KEY` locally. Set the same variables in the
Vercel project settings. Never commit `.env.local` or real credentials.
Do not prefix these secrets with `NEXT_PUBLIC_`.
All Qloo and Gemini requests must run in server route handlers under `app/api/`.

## Deploy

Publish this folder as a public GitHub repository, including `LICENSE`,
`.gitignore`, `.env.example`, and `package-lock.json`.
Import the repository into Vercel with the Next.js framework preset and the
repository root as the Root Directory. The default build command is `npm run build`.
Use Node.js 24.x in the project settings. No environment variables are required
for the current profile form. Open the production URL after the deployment is ready.

## License

MIT. See [LICENSE](LICENSE).

A conversation aid, not medical advice.

## Profile payload

See `lib/profile.ts` for the shared TypeScript types. `knownFavorites[].type` uses
`artist`, `movie`, or `tv_show`, ready for the later Qloo resolve route.
`topicsToAvoid` contains selected checkbox labels; `otherTopicsToAvoid` preserves
the optional free-text instructions.

## Repository checks

Verified the public repository has no tracked `.env.local`, and GitHub recognizes
`LICENSE` as MIT (`spdx_id: MIT`). `.env.example` contains variable names only.
