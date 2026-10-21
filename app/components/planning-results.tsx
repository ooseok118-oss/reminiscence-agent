import type { PlanResponse, ReviewResponse } from "@/lib/plan-schema";
import type { Seed } from "@/lib/qloo-types";
import type { Feedback } from "@/lib/replan-schema";
import SessionPlan, { type Draft } from "./session-plan";

type Props = {
  review: ReviewResponse | null;
  planned: PlanResponse | null;
  firstName: string;
  seeds: Seed[];
  birthYear: number;
  sessionNumber?: number;
  onPlanNext?: (feedback: Feedback[], note: string) => void;
  busy?: boolean;
  draft?: Draft;
  onDraftChange?: (draft: Draft) => void;
  scrollOnMount?: boolean;
};

export default function PlanningResults({ review, planned, firstName, seeds, birthYear, sessionNumber = 1, onPlanNext, busy, draft, onDraftChange, scrollOnMount }: Props) {
  if (!review) return null;
  const { counts, items, warnings } = review.review;
  const setAside = items.filter((item) => item.verdict === "exclude");
  const limited = items.filter((item) => item.verdict === "caution");
  const name = firstName || "them";

  return (
    <div className="mt-8 space-y-6">
      {planned ? <SessionPlan plan={planned.plan} firstName={firstName} seeds={seeds} birthYear={birthYear} sessionNumber={sessionNumber} onPlanNext={onPlanNext} busy={busy} draft={draft} onDraftChange={onDraftChange} scrollOnMount={scrollOnMount} /> : null}

      <section aria-labelledby={`safety-heading-${sessionNumber}`} className="rounded-2xl border border-stone-200 p-5 sm:p-6 print:hidden">
        <h2 id={`safety-heading-${sessionNumber}`} className="text-lg font-semibold text-stone-900">{sessionNumber === 1 ? "How the safety check went" : `How the safety check went for session ${sessionNumber}`}</h2>
        <p className="mt-2 text-base leading-relaxed text-stone-700">
          {counts.exclude ? `Set aside ${counts.exclude} of ${items.length} suggestions for ${name}.` : `None of the ${items.length} suggestions needed to be set aside.`}
          {counts.caution ? ` ${counts.caution} stayed in with limits on what to talk about.` : ""}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">For the caregiver only: reasons below may name sensitive topics. The check is an AI judgment, not a guarantee.</p>
        {warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-900">{warning}</p>)}

        {setAside.length ? (
          <ul aria-label="Set aside" className="mt-4 space-y-2">
            {setAside.map((item) => (
              <li key={item.entity_id} className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                <span className="font-semibold">{item.name}</span> was set aside. {item.reason}
              </li>
            ))}
          </ul>
        ) : null}

        {limited.length ? (
          <details className="mt-4">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-900">Kept with limits ({limited.length})</summary>
            <ul className="mt-2 space-y-2">
              {limited.map((item) => (
                <li key={item.entity_id} className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-700">
                  <span className="font-semibold text-stone-900">{item.name}</span> (talk only about these): {item.safe_angles.join("; ")}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-900">Every screening decision ({items.length})</summary>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item.entity_id} className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
                <p className="font-semibold">{item.name} <span className="font-normal text-stone-500">({item.verdict})</span></p>
                <p className="mt-1 text-stone-600">{item.reason}</p>
              </li>
            ))}
          </ul>
        </details>

        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-teal-900">Raw data (JSON)</summary>
          {planned ? (
            <>
              <p className="mt-2 text-sm text-stone-600">Session plan, written by {planned.model}</p>
              <pre className="mt-1 max-h-[32rem] overflow-auto rounded-xl bg-stone-950 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-stone-100" tabIndex={0} aria-label="Session plan JSON">{JSON.stringify(planned.plan, null, 2)}</pre>
            </>
          ) : null}
          <p className="mt-3 text-sm text-stone-600">Safety review</p>
          <pre className="mt-1 max-h-96 overflow-auto rounded-xl bg-stone-100 p-4 text-xs whitespace-pre-wrap break-words" tabIndex={0} aria-label="Safety review JSON">{JSON.stringify(review.review, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
