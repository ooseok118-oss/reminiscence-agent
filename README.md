# Reminiscence Agent

A conversation aid for caregivers and families, inspired by familiar favorites.

## Status

Step 1: a deployable Next.js starter with an English placeholder page.
Profile entry and Qloo/Gemini integration will be added in later steps.

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

The placeholder page builds and runs without API keys.
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
for the current placeholder. Open the production URL after the deployment is ready.

## License

MIT. See [LICENSE](LICENSE).

A conversation aid, not medical advice.
