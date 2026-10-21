import type { AgentDecision } from "@/lib/replan-schema";
import { joinNames } from "./agent-progress";

// What the planning agent changed between sessions, and why, in the caregiver's terms.
export default function AgentNote({ decision, sessionNumber }: { decision: AgentDecision; sessionNumber: number }) {
  const rows = [
    { label: "Now building on", value: joinNames(decision.seeds.map((seed) => seed.name)) },
    decision.added.length ? { label: "Newly added", value: joinNames(decision.added) } : null,
    decision.set_aside.length ? { label: "Left out", value: joinNames(decision.set_aside) } : null,
    decision.extra_topics.length ? { label: "Also avoiding", value: joinNames(decision.extra_topics) } : null,
  ].filter((row) => row !== null);

  return (
    <section aria-labelledby={`agent-note-${sessionNumber}`} className="rounded-2xl border border-teal-900/15 bg-white p-5 sm:p-6 print:hidden">
      <h2 id={`agent-note-${sessionNumber}`} className="text-lg font-semibold text-stone-900">What changed for session {sessionNumber}</h2>
      <p className="mt-2 text-base leading-relaxed text-stone-800">{decision.rationale}</p>
      {decision.next_focus ? <p className="mt-2 text-base text-teal-900">Next focus: {decision.next_focus}</p> : null}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="font-semibold text-stone-700">{row.label}</dt>
            <dd className="text-stone-800">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-stone-500">
        {decision.source === "agent"
          ? "Decided by the planning agent from your notes. Anything already used was left out of the new Qloo search."
          : "Decided with simple rules because the AI was unavailable. Anything already used was left out of the new Qloo search."}
      </p>
    </section>
  );
}
