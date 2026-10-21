import type { ReviewResponse } from "@/lib/plan-schema";
import type { Expansion, Seed } from "@/lib/qloo-types";

export type AgentStage = "idle" | "resolve" | "expand" | "review" | "plan" | "done";

const ORDER: AgentStage[] = ["resolve", "expand", "review", "plan"];
const KIND = { artist: "singer", movie: "film", tv_show: "TV show" };

export function joinNames(names: string[]) {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function setAsideSummary(review: ReviewResponse) {
  const { exclude, caution } = review.review.counts;
  const first = exclude
    ? `Set aside ${exclude} ${exclude === 1 ? "item that touches" : "items that touch"} on topics to avoid`
    : "Nothing needed to be set aside";
  return caution ? `${first}. ${caution} kept with gentle limits on what to talk about.` : `${first}.`;
}

type Props = {
  stage: AgentStage;
  failed: boolean;
  seeds: Seed[];
  result: Expansion | null;
  review: ReviewResponse | null;
};

export default function AgentProgress({ stage, failed, seeds, result, review }: Props) {
  if (stage === "idle") return null;
  const current = stage === "done" ? ORDER.length : ORDER.indexOf(stage);
  const connections = result ? result.categories.reduce((total, category) => total + category.items.length, 0) : 0;
  const steps = [
    {
      title: "Finding their favorites in Qloo’s taste graph",
      detail: seeds.length ? `Matched ${joinNames(seeds.map((seed) => `${seed.name} (${seed.release_year ? `${seed.release_year} ` : ""}${KIND[seed.type]})`))}.` : "",
    },
    {
      title: "Following their taste to films, TV and music",
      detail: result ? `${connections} connections from ${result.era.from} to ${result.era.to}, the years they were 10 to 30.` : "",
    },
    { title: "Checking topics to avoid", detail: review ? setAsideSummary(review) : "" },
    { title: "Writing a 30-minute session", detail: stage === "done" ? "Ready below." : "" },
  ];

  return (
    <ol aria-label="Session building progress" className="mb-5 space-y-1 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current && stage !== "done";
        const stopped = active && failed;
        return (
          <li key={step.title} className="flex gap-4 py-2" aria-current={active ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done ? "bg-teal-800 text-white"
                  : stopped ? "border-2 border-rose-700 text-rose-800"
                    : active ? "border-2 border-teal-800 text-teal-900"
                      : "border border-stone-300 text-stone-500"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
              ) : active && !stopped ? (
                <span className="size-2.5 rounded-full bg-teal-800 motion-safe:animate-pulse" />
              ) : (
                index + 1
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-base ${done || active ? "font-semibold text-stone-900" : "text-stone-500"}`}>
                {step.title}
                <span className="sr-only">{done ? " (done)" : stopped ? " (stopped)" : active ? " (in progress)" : " (waiting)"}</span>
              </p>
              {step.detail ? <p className="mt-0.5 text-sm leading-relaxed text-stone-600">{step.detail}</p> : null}
              {active && !stopped && index > 0 ? <p className="mt-0.5 text-sm text-stone-500">This step usually takes 10 to 30 seconds.</p> : null}
              {stopped ? <p className="mt-0.5 text-sm text-rose-800">Stopped here. See the message below.</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
