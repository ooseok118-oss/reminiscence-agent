"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { SessionPlan as Plan } from "@/lib/plan-schema";
import type { Seed } from "@/lib/qloo-types";
import { joinNames } from "./agent-progress";

const KIND = { artist: "Music", movie: "Film", tv_show: "TV show" };
// One color per part of the session, shared by the time bar and each section's marker.
const TONE = { music: "bg-teal-600", conversation: "bg-teal-900", sensory: "bg-amber-500" };
const PARTS = [
  { label: "Opening song", minutes: 5, tone: TONE.music },
  { label: "Conversation", minutes: 15, tone: TONE.conversation },
  { label: "Sensory activity", minutes: 5, tone: TONE.sensory },
  { label: "Closing song", minutes: 5, tone: TONE.music },
];

function TimeBar() {
  return (
    <div className="mt-6">
      <div aria-hidden="true" className="flex h-3 gap-1 overflow-hidden rounded-full">
        {PARTS.map((part) => <span key={part.label} className={part.tone} style={{ flexGrow: part.minutes, flexBasis: 0 }} />)}
      </div>
      <ul aria-label="Session timing" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-stone-600">
        {PARTS.map((part) => (
          <li key={part.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${part.tone}`} />
            <span><span className="font-semibold text-stone-800">{part.label}</span> <span className="tabular-nums">{part.minutes} min</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Part({ tone, minutes, title, children }: { tone: string; minutes: string; title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-stone-200 pt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`h-5 w-1.5 rounded-full ${tone}`} />
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        <span className="ml-auto text-sm text-stone-500 tabular-nums">{minutes}</span>
      </div>
      <div className="mt-4 space-y-4 sm:pl-[1.125rem]">{children}</div>
    </section>
  );
}

function Item({ name, kind, why }: { name: string; kind: keyof typeof KIND; why: string }) {
  return (
    <div>
      <p className="text-xl font-semibold leading-snug text-stone-900">
        {name} <span className="ml-1 align-middle text-sm font-normal text-stone-500">{KIND[kind]}</span>
      </p>
      {why ? <p className="mt-1 text-sm text-teal-900">Why this: {why}</p> : null}
    </div>
  );
}

function Songs({ songs }: { songs: string[] }) {
  if (!songs.length) return <p className="text-base text-stone-700">Choose a familiar recording together.</p>;
  return (
    <div>
      <p className="text-sm font-semibold text-stone-700">Recordings to try</p>
      <ul className="mt-1 space-y-0.5 text-base text-stone-900">
        {songs.map((song) => <li key={song}>{song}</li>)}
      </ul>
      <p className="mt-1 text-sm text-stone-500">Suggested by AI. Listen first to check it feels right.</p>
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-stone-100 px-4 py-3 text-base leading-relaxed text-stone-800"><span className="font-semibold">Tip: </span>{children}</p>;
}

export default function SessionPlan({ plan, firstName, seeds }: { plan: Plan; firstName: string; seeds: Seed[] }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const name = firstName || "them";
  const topicMinutes = Math.round(15 / Math.max(1, plan.conversation.length));

  return (
    <article aria-labelledby="session-heading" className="border-t border-stone-200 bg-white pt-8 sm:rounded-3xl sm:border sm:border-teal-900/15 sm:p-8 print:border-0 print:p-0">
      <h2 id="session-heading" ref={heading} tabIndex={-1} className="scroll-mt-6 text-3xl font-semibold tracking-tight text-stone-900 focus:outline-none">
        A 30-minute session for {name}
      </h2>
      {seeds.length ? <p className="mt-2 text-base text-stone-600">Built from their love of {joinNames(seeds.map((seed) => seed.name))}.</p> : null}
      <TimeBar />

      <div className="mt-8 space-y-8">
        <Part tone={TONE.music} minutes="0–5 min" title="Opening song">
          <Item name={plan.opening_song.item} kind={plan.opening_song.type} why={plan.opening_song.why_this} />
          <Songs songs={plan.opening_song.songs} />
          <Tip>{plan.opening_song.caregiver_tip}</Tip>
        </Part>

        <Part tone={TONE.conversation} minutes="5–20 min" title="Conversation">
          <p className="text-base text-stone-600">
            About {topicMinutes} minutes for each. Read a question aloud, then follow where {name} takes it. There are no wrong answers.
          </p>
          {plan.conversation.map((topic) => (
            <div key={topic.item} className="break-inside-avoid space-y-3 pt-2">
              <Item name={topic.item} kind={topic.type} why={topic.why_this} />
              <ul aria-label={`Questions about ${topic.item}`} className="space-y-3">
                {topic.prompts.map((prompt) => (
                  <li key={prompt} className="border-l-2 border-teal-800/30 pl-4 font-serif text-[1.3rem] leading-snug text-stone-900">{prompt}</li>
                ))}
              </ul>
            </div>
          ))}
        </Part>

        <Part tone={TONE.sensory} minutes="20–25 min" title="Sensory activity">
          <Item name={plan.sensory_activity.item} kind={plan.sensory_activity.type} why={plan.sensory_activity.why_this} />
          <p className="text-lg leading-relaxed text-stone-900">{plan.sensory_activity.activity}</p>
          {plan.sensory_activity.materials.length ? (
            <div>
              <p className="text-sm font-semibold text-stone-700">Have ready</p>
              <ul className="mt-2 space-y-1.5">
                {plan.sensory_activity.materials.map((material) => (
                  <li key={material} className="flex items-center gap-3 text-base text-stone-900">
                    <span aria-hidden="true" className="size-4 shrink-0 rounded border border-stone-400" />
                    {material.charAt(0).toUpperCase() + material.slice(1)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Part>

        <Part tone={TONE.music} minutes="25–30 min" title="Closing song">
          <Item name={plan.closing.item} kind={plan.closing.type} why={plan.closing.why_this} />
          <Songs songs={plan.closing.songs} />
          <Tip>{plan.closing.caregiver_tip}</Tip>
        </Part>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-stone-200 pt-6">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-12 rounded-xl bg-teal-800 px-5 py-3 text-base font-semibold text-white hover:bg-teal-900 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-teal-700 print:hidden"
        >
          Print this plan
        </button>
        <p className="text-sm leading-relaxed text-stone-600">
          A conversation aid, not medical advice. If {name} seems uneasy, pause or change the subject.
        </p>
      </div>
    </article>
  );
}
