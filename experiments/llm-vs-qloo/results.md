# LLM vs Qloo — completed-result summary

Experiment completed: 2026-10-24. Publication update: 2026-10-29.

## Provenance and audit status

This summary transcribes the final measurements reported in the project's experiment handover. The original completed archive, `llm-vs-qloo-complete-20261024.zip`, was not accessible in the publication workspace. Raw JSON, exact baseline prompts/settings, per-profile results, matching decisions and `run.mjs` have therefore **not** been independently re-audited or published here. No missing files or measurements have been reconstructed. This is a summary, not the full reproducibility package.

## Conditions

- A1: `gemini-3.5-flash-lite`, eight profiles (P1–P5, Q1–Q3), two runs each, 16/16 complete.
- A2: same baseline prompt, profiles and settings as A1 according to the experiment record; 16/16 complete. Initial requests named `gemini-3.5-flash`, with successful responses reporting `gemini-3.6-flash`; continuation requests named `gemini-3.6-flash`. Successful outputs were retained while missing slots were completed across several days.
- B: deployed Qloo resolve/expand pipeline, eight profiles, one run each. No repeatability measurement.
- P1–P5 candidate totals: 240 in A1, 240 in A2, **120 in B**.
- Q1–Q3 share birth year 1948 and hometown Columbus; favorites differ.
- Matching: Qloo `/search`, shared matching rule. Film/TV window: birth year +10 through +30, denominator restricted to known release years.

## Final reported results

| Metric | A1 | A2 | B |
| --- | ---: | ---: | ---: |
| Film/TV age-window fit, known years only | 91.8% | 89.5% | 100% |
| Personalization: mean Q1–Q3 Jaccard | 0.268 | 0.265 | 0.044 |
| Repeatability: mean same-profile two-run Jaccard | 0.493 | 0.663 | Not measured |

Jaccard = intersection / union. It is not simply the percentage of one list shared with another. Lower cross-profile Jaccard indicates greater list differentiation; higher within-profile Jaccard indicates greater repeatability. Neither establishes relevance or clinical benefit.

## A2 compared with A1

A2's age-window fit was 2.3 percentage points lower than A1's. Its personalization Jaccard was almost unchanged, at 0.265 versus 0.268. Its repeatability Jaccard was higher, at 0.663 versus 0.493. These findings do not show an improvement in recommendation quality or prove Qloo's necessity.

## Limits and unresolved audit items

- Eight profiles, no caregiver study and no clinical outcome measurement.
- B's age window is filtered, and B removes input favorites; neither advantage can be attributed solely to Qloo's taste graph.
- B was run only once per profile; claims that it always returns identical results are unsupported.
- A1's five apparent year mismatches included four popularity-based remake matches according to the handover. This is a matching artifact, not necessarily a factual error by the LLM.
- Identical title/description/year/avoid-topic inputs received different safety judgments in different lists/calls. Automated safety judgments are not guarantees.
- Exact final A2 search-match counts, year-error counts and safety counts are not available in the visible final handover and are deliberately omitted.
- Recover and inspect the original archive before publishing raw data or claiming complete reproducibility. Check keys, proof values and personal information before publishing.

No API keys, proof tokens or personal profile records are included in this summary.
