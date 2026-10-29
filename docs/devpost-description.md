# Devpost project description — Reminiscence Agent

## Tagline

Turn one favorite song into a 30-minute conversation.

## Inspiration

A family caregiver may know a favorite singer or film, yet still need help turning it into a warm conversation. Reminiscence Agent starts with those few favorites and prepares a session the caregiver can read aloud. It is a conversation aid, not medical advice.

## What it does

Enter a nickname, birth year, hometown, one to three favorites, and topics to avoid. Qloo resolves the favorites to real entities and expands them across music artists, films and TV from the person's youth. Gemini screens the candidates and writes a 30-minute plan with an opening song, three conversation items, a seated sensory activity and a calm closing song.

Each item includes open questions, an age-at-release note where available, and a “Why this” explanation based on Qloo contribution scores. Afterward, the caregiver records Enjoyed it, Neutral or Seemed uneasy. The agent uses that feedback to choose new starting points and excludes used or uneasy items by Qloo ID for the next session. The app supports printing and saving/resuming in the same browser.

## How we built it

Next.js, React, TypeScript, Tailwind CSS, Vercel AI SDK, Zod, Gemini and Qloo. The server uses Qloo /search for favorite resolution and /v2/insights for cross-category expansion, release-year filtering, explanations and exclusions. Gemini handles safety judgments, session writing and replanning. Code validates the approved item IDs, question wording, length and repeated artists; HMAC seals protect intermediate candidate and review data.

## Why Qloo

Qloo provides a taste graph, stable entity IDs and contribution scores that the workflow uses directly. We compared an LLM-only baseline (A1), a second LLM condition (A2), and the Qloo candidate pipeline (B) across eight profiles. A1 and A2 each completed 16 runs; B ran once per profile.

| Metric | A1 | A2 | B |
| --- | ---: | ---: | ---: |
| Film/TV age-window fit, known years only | 91.8% | 89.5% | 100% |
| Q1–Q3 mean Jaccard | 0.268 | 0.265 | 0.044 |
| Same-profile two-run mean Jaccard | 0.493 | 0.663 | Not measured |

B's lists differed more when favorites changed in this small sample. A2 was more repeatable than A1 but had lower age-window fit and similar cross-profile overlap. B's 100% age-window result reflects filtering; we do not claim the experiment proves Qloo indispensable, safer or clinically more effective. The public experiment summary records that the original raw archive still needs to be restored for a full independent audit.

## Challenges and lessons

Models sometimes bend wording and duplication rules, so we added code validation and repairs. Safety judgments can vary even for identical descriptions; caregivers should review every plan and follow the person's comfort. Quota and model-overload errors interrupted A2, so successful responses were preserved and only missing runs were resumed.

## Limitations and next steps

The app is English-language and US-centric. It has not been tested with caregivers or people living with dementia, and it makes no clinical effectiveness claim. Free-tier model limits can interrupt planning. Next steps are restoring the full experiment audit package, caregiver usability testing, and evaluating cultural coverage.

## Try it

Live app: https://reminiscence-agent.vercel.app/
Source: https://github.com/ooseok118-oss/reminiscence-agent
License: MIT

Press **Try an example**, then **Build a gentle session**. Review the plan, mark reactions, and build the next session.

## Publication status

Prepared from the current public README and final experiment handover on 2026-10-29. This file is submission-ready copy, not evidence that a Devpost project has been saved or submitted.
