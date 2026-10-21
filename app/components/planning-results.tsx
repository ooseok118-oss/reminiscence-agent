import type { PlanResponse, ReviewResponse } from "@/lib/plan-schema";

export default function PlanningResults({ review, planned }: { review: ReviewResponse | null; planned: PlanResponse | null }) {
  if (!review) return null;
  const { counts, items, warnings } = review.review;
  return (
    <section aria-labelledby="safety-heading" className="mt-8 space-y-6 border-t border-stone-200 pt-8">
      <div>
        <p className="text-sm font-semibold text-teal-800">STEP 4 · SAFETY REVIEW &amp; SESSION JSON</p>
        <h2 id="safety-heading" className="mt-2 text-2xl font-semibold">A thoughtful check before planning</h2>
        <p className="mt-3 rounded-xl bg-teal-50 p-4 text-teal-950">Set aside {counts.exclude} items that touch on topics to avoid. {counts.caution} items need care; {counts.ok} have no concerns flagged.</p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">Caregiver review only: reasons below may name sensitive topics. Screening is a model judgment, not a guarantee. Pause or change direction if the person seems uncomfortable.</p>
        {warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-900">{warning}</p>)}
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer font-semibold text-teal-900">All screening decisions ({items.length})</summary>
        <ul className="mt-4 space-y-4">
          {items.map((item) => <li key={item.entity_id} className="rounded-xl border border-stone-200 p-4 text-sm">
            <p className="font-semibold">{item.name} · {item.verdict}</p>
            <p className="mt-1 text-stone-600">{item.reason}</p>
            {item.safe_angles.length ? <p className="mt-2 text-teal-900">Safe angles: {item.safe_angles.join("; ")}</p> : null}
          </li>)}
        </ul>
      </details>
      {items.some((item) => item.verdict === "exclude") ? <div>
        <h3 className="text-lg font-semibold">Set aside and why</h3>
        <ul className="mt-3 space-y-3">
          {items.filter((item) => item.verdict === "exclude").map((item) => <li key={item.entity_id} className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><strong>{item.name}</strong>: {item.reason}</li>)}
        </ul>
      </div> : null}
      {planned ? <div>
        <h2 className="text-2xl font-semibold">Session plan JSON</h2>
        <p className="mt-2 text-sm text-stone-600">30 minutes: opening 5 · conversation 15 · sensory activity 5 · closing 5. Music identifies a Qloo artist; choose a familiar recording together.</p>
        <pre className="mt-4 max-h-[42rem] overflow-auto rounded-xl bg-stone-950 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-stone-100" tabIndex={0} aria-label="Session plan JSON">{JSON.stringify(planned.plan, null, 2)}</pre>
      </div> : null}
      <details>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-teal-900">Safety review JSON</summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-stone-100 p-4 text-xs whitespace-pre-wrap break-words" tabIndex={0}>{JSON.stringify(review.review, null, 2)}</pre>
      </details>
    </section>
  );
}
