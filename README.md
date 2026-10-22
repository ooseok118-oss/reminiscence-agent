# Reminiscence Agent

**Turn one favorite song into a 30-minute conversation.**

Reminiscence Agent helps caregivers of people living with dementia prepare a reminiscence session. Name one to three things the person loves: a singer, a film, a TV show. The agent follows their taste through Qloo's taste graph to the music, films and shows of their youth, sets aside anything that could upset them, and writes a 30-minute session a caregiver can read aloud. After the session, the caregiver records how each item landed, and the agent plans the next one from that.

- **Live demo:** https://reminiscence-agent.vercel.app (press **Try an example**, then **Build a gentle session**)
- **Built for:** [Qloo Agentic Hackathon](https://qloo.devpost.com)
- **License:** MIT

> A conversation aid, not medical advice.

---

## The problem

Reminiscence activities, talking about music, films and everyday life from someone's past, are a common, low-pressure way to connect with people living with dementia. Preparing one well is hard work for a family member or a care-home aide:

- They have to find what the person actually loved when they were young, not just the decade's biggest hits.
- They have to avoid topics that could cause distress, such as war, a lost spouse or a hard move.
- They have to write open, warm questions. Quiz-style questions ("Do you remember...?", "What year was...?") feel like a memory test and cause stress.

Most caregivers know one or two favorites. That is where this app starts.

## What the app does

1. **Tell us about the person.** First name, birth year, hometown, 1–3 favorites, and topics to avoid.
2. **Find the favorites in Qloo.** Each favorite is matched to a real Qloo entity ID.
3. **Follow their taste back in time.** Qloo's taste graph expands the favorites into films, TV shows and music artists from the person's *reminiscence bump*: the years they were 10 to 30, which people tend to remember most vividly.
4. **Screen for safety.** Every candidate is marked `exclude`, `caution` (allowed only through a named safe angle) or `ok`, against the caregiver's topics and a default list of hard topics (war, the Holocaust, violent crime, terminal illness, suicide).
5. **Write the session.** Opening song (5 min) → conversation about one film, one TV show and one artist (15 min) → seated sensory activity (5 min) → calm closing song (5 min).
6. **Check the session in code.** Rule checks block quiz questions, title-guessing questions, avoided topics and repeated artists before anything reaches the screen.
7. **Learn from the session.** The caregiver marks each item *Enjoyed it*, *Neutral* or *Seemed uneasy* and can add a note. The agent decides what to build on and what to leave out, then searches Qloo again for the next session.

### What the caregiver sees

- A timeline with the four parts of the session and their minutes.
- Three questions per conversation item, written to be read aloud.
- **Why this:** each item says which favorite it came from, based on Qloo's contribution scores (for example, *"Mostly inspired by Elvis Presley"*).
- **Age at release:** "Mary was 17 when it came out."
- YouTube and photo search links that use only the title, never personal details.
- A short "If Mary seems upset" note on how to pause or change direction.
- **What changed for session 2:** a plain explanation of what the agent kept, added and set aside.
- Print, save and resume (stored in the browser only), and a mobile layout.

## Why Qloo, and how we tested it

The hackathon asks a fair question: *would this work just as well without Qloo?* A large language model also knows a lot about 1960s pop culture. So we ran a side-by-side test.

**Setup**

- **LLM only:** `gemini-3.5-flash-lite` with our best prompt. It got the same profile, the same favorites, the same age window, and an explicit instruction to personalize to the favorites instead of listing the era's biggest hits. Each profile was run twice.
- **With Qloo:** our deployed app (`/api/resolve` → `/api/expand`), first 8 results per category.
- **Profiles:** 5 people born between 1938 and 1955, plus 3 profiles that share everything (born 1948, Columbus) **except** their favorites: Elvis Presley + *Roman Holiday*; Johnny Cash; Aretha Franklin + *The Twilight Zone*.
- Both sides were checked the same way: every title was looked up in Qloo search, and both went through the same safety screen.

**Results**

| What we measured | LLM only | With Qloo |
| --- | --- | --- |
| Overlap between the three 1948 profiles' lists (Jaccard; lower = more personal) | **0.27** | **0.04** |
| Same person asked twice: agreement between the two lists | 0.33–0.60 | identical for the same input |
| Titles found in Qloo search | 235 of 240 (the misses were mostly real works our matcher missed) | 240 of 240 |
| Works inside the 10–30 age window | 92% | 100% (enforced by our filters) |

**What this shows**

- **Personalization is where Qloo makes the difference.** For three people born the same year in the same city, the LLM's lists overlapped 27%. It kept returning era staples such as *The Brady Bunch* and *The Mary Tyler Moore Show* regardless of taste. With Qloo, the lists overlapped 4%.
- **Much of the LLM's variation is randomness, not taste.** Asked twice about the same person, it changed roughly half its list.
- **The LLM is good at facts.** Almost every title it gave was real, and its release years were accurate once remakes were accounted for. We do not claim that Qloo reduces hallucination or improves date accuracy, and the safety-screen results were not comparable between the two setups.

**Not measured, but built into the design:** "Why this" comes from a measured contribution score, not a model's guess. And because every item has a fixed Qloo ID, the next session can exclude exactly what was used or caused unease.

**Limits of the test:** 8 profiles is a small sample. Our app removes the input favorites from its results by design. The 100% age-window figure is guaranteed by our filters, not a finding. A run with a stronger Gemini model was cut short by the free daily quota, so it is not included. Title matching has some error.

Full method, numbers and raw outputs: [`experiments/llm-vs-qloo/`](experiments/llm-vs-qloo/).

## How the agent works

```mermaid
flowchart LR
    A["Caregiver input<br/>name, birth year,<br/>favorites, topics"] --> B["/api/resolve<br/>Qloo search → entity IDs"]
    B --> C["/api/expand<br/>Qloo insights:<br/>films · TV · music<br/>age 10–30"]
    C --> D["/api/plan · review<br/>Gemini safety screen<br/>exclude · caution · ok"]
    D --> E["/api/plan · generate<br/>Gemini writes session<br/>+ rule checks in code"]
    E --> F["Session screen<br/>caregiver runs it"]
    F --> G["/api/replan<br/>reactions + note →<br/>new starting points,<br/>extra topics to avoid"]
    G -->|"excludes used and<br/>uneasy items by ID"| C
```

### Qloo does the taste work

| Step | Qloo call | Details |
| --- | --- | --- |
| Resolve favorites | `GET /search` | Picks the most popular result of the chosen type (artist, movie, TV show). An unmatched favorite returns a clear error instead of a silent substitute. |
| Expand by taste | `GET /v2/insights` (three calls in parallel) | `signal.interests.entities` = all favorites, `filter.type` = movie / TV show / artist, `take=12`, `feature.explainability=true`. |
| Age window | `filter.release_year.min/max` | Birth year +10 to +30 for films and TV. For artists, the app checks that their active years overlap the window. |
| Quality | `filter.popularity.min` | Films ≥ 0.8, TV ≥ 0.5. If fewer than three remain: lower to 0.5 / 0.2, then widen the window by five years on each side. |
| Explain | explainability scores | Each item keeps each favorite's contribution. The UI turns the top contribution into a sentence ("Mostly inspired by…", or "Because they enjoyed X in an earlier session"). |
| Next session | `filter.exclude.entities` | Items already used or marked uneasy are excluded by ID, and filtered again in code. |

### Gemini does the judgment and the writing

All model calls use `gemini-3.5-flash-lite` with structured output (Zod schemas, through the Vercel AI SDK).

- **Safety review** screens every candidate. Caregiver topics take priority. A candidate is excluded only when an avoided topic is its central subject; a sensitive side plot makes it *caution* instead. *Caution* items carry "safe angles" (for example, the costumes or the music) that the session must stay inside.
- **Session writing** uses only approved items, copies their IDs exactly, and ties each question to the person's own life: who they went with, what they wore, where they danced.
- **Replanning** reads the caregiver's reactions and note, picks up to two enjoyed items as new starting points, keeps the original favorites unless the note says otherwise, and adds up to three short topics to avoid. If the model fails, a simple rule-based decision takes over, so the caregiver always gets a next session.

### Code checks what the model writes

Models sometimes bend rules. We found it more reliable to check in code than to keep rewording prompts:

- Each question must start with *What, How, Who* or *Where*. "Remember", "recall", "What year…", "Who starred in…" and questions that ask the person to name songs, films or people are rejected.
- Every item in the plan must come from the approved pool. Excluded or invented items cannot pass.
- The opening and closing songs must be different artists. A duplicate is swapped automatically.
- Questions and tips must be short enough to read aloud.
- The session writer gets up to three attempts, with the broken rule fed back each time. On the last attempt, a slot that still breaks a rule is filled safely from the approved pool instead of failing the whole session.

### Data stays small and sealed

- Data passed between steps (Qloo results, safety verdicts) is sealed with an HMAC (`lib/proof.ts`) that expires after 30 minutes, so the browser cannot alter the approved pool between review and writing.
- The server does not store profiles. Saved sessions live in the caregiver's browser (`localStorage`).
- Logs record only the stage and HTTP status, never profiles, keys or model output.

## Limitations

- **Safety screening is a model judgment, not a guarantee.** The same title can be marked *caution* in one run and *exclude* in another. Code checks catch format and wording problems, not meaning. Caregivers should read the plan first.
- **No song titles from Qloo.** Qloo returns artists, not verified recordings. The app names songs only when the model is confident they are well known and gentle; otherwise it leaves the choice to the caregiver.
- **US-centric.** The app is in English and built around American popular culture.
- **Free-tier limits.** The demo runs on Gemini's free tier. If the daily quota runs out, planning shows a "busy" message until it resets.
- **Not yet tested with caregivers.** We have not run sessions with people living with dementia. Any clinical use would need that work first.

## Run it locally

Requirements: Node.js 24, a Qloo hackathon API key, and a Gemini API key from Google AI Studio.

```bash
npm ci
cp .env.example .env.local   # then fill in QLOO_API_KEY and GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Keys are read only on the server. Never commit `.env.local`, and never prefix a key with `NEXT_PUBLIC_`.

Checks:

```bash
npm test            # 25 tests: Qloo matching, age window, explanations, plan rules, replanning
npm run lint
npm run typecheck
npm run build
```

The live demo runs on Vercel and deploys from `main`. Set `QLOO_API_KEY` and `GEMINI_API_KEY` in the project's environment variables, then redeploy.

## Project layout

| Path | What it does |
| --- | --- |
| `app/page.tsx` | Landing text and "How it works" |
| `app/components/profile-form.tsx` | Input form, call sequence, retries, save and resume |
| `app/components/session-plan.tsx` | Session screen, reactions, print |
| `app/components/agent-note.tsx` | "What changed for session N" |
| `app/api/{resolve,expand,plan,replan}` | Server routes |
| `lib/qloo-server.ts`, `lib/qloo-data.ts` | Qloo calls, filter relaxing, exclusions, "Why this" |
| `lib/safetyPrompt.ts`, `lib/prompt.ts`, `lib/replanPrompt.ts` | Prompts for safety review, session writing and replanning |
| `lib/plan-schema.ts`, `lib/replan-schema.ts` | Code checks and repairs |
| `lib/gemini-server.ts` | Gemini calls and retries |
| `lib/proof.ts` | HMAC sealing between steps |
| `tests/` | Automated tests |

## Built with

Qloo Taste AI API · Google Gemini (`gemini-3.5-flash-lite`) · Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Vercel AI SDK · Zod · Vercel

## License

MIT. See [LICENSE](LICENSE).
