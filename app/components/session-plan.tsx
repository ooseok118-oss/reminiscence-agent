"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionPlan as Plan } from "@/lib/plan-schema";
import type { Seed } from "@/lib/qloo-types";
import type { Feedback, Reaction } from "@/lib/replan-schema";
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

// How old the person was when a film came out or a show first aired. Reminiscence works
// best with the years someone was roughly 10 to 30, so this makes the choice visible.
function ageLine(kind: keyof typeof KIND, year: number | null, person: string, birthYear: number) {
  if (kind === "artist" || !year || !birthYear) return "";
  const age = year - birthYear;
  if (age < 0 || age > 110) return "";
  return `${person} was ${age} when it ${kind === "movie" ? "came out" : "first aired"}`;
}

function Item({ name, kind, why, year, person, birthYear }: { name: string; kind: keyof typeof KIND; why: string; year: number | null; person: string; birthYear: number }) {
  const age = ageLine(kind, year, person, birthYear);
  return (
    <div>
      <p className="text-xl font-semibold leading-snug text-stone-900">
        {name} <span className="ml-1 align-middle text-sm font-normal text-stone-500">{KIND[kind]}{year && kind !== "artist" ? `, ${year}` : ""}</span>
      </p>
      {age ? <p className="mt-0.5 text-sm text-stone-600">{age}</p> : null}
      {why ? <p className="mt-1 text-sm text-teal-900">Why this: {why}</p> : null}
    </div>
  );
}

// Search links only: no account, and nothing about the person goes into the URL.
const youtube = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
const imageSearch = (query: string) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
function Find({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg text-sm font-semibold text-teal-900 underline decoration-teal-800/30 underline-offset-4 hover:decoration-teal-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-700 print:hidden">
      {children}
      <span className="sr-only"> (opens a search in a new tab)</span>
    </a>
  );
}
function clipQuery(entry: { item: string; type: keyof typeof KIND; year: number | null }) {
  return entry.type === "artist" ? `${entry.item} songs` : `${entry.item}${entry.year ? ` ${entry.year}` : ""} ${entry.type === "movie" ? "film" : "TV show"} clip`;
}

const CHOICES: { value: Reaction; label: string; on: string }[] = [
  { value: "enjoyed", label: "Enjoyed it", on: "border-teal-800 bg-teal-800 text-white" },
  { value: "neutral", label: "Neutral", on: "border-stone-600 bg-stone-600 text-white" },
  { value: "uneasy", label: "Seemed uneasy", on: "border-amber-600 bg-amber-100 text-amber-950" },
];

// After the session, the caregiver marks how each item landed. Pressing a chosen
// button again clears it.
function ReactionPicker({ item, person, value, onChange }: { item: string; person: string; value?: Reaction; onChange: (next?: Reaction) => void }) {
  return (
    <div role="group" aria-label={`How did ${person} respond to ${item}?`} className="flex flex-wrap items-center gap-2 print:hidden">
      <span className="mr-1 text-sm text-stone-500">How did it go?</span>
      {CHOICES.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={value === choice.value}
          onClick={() => onChange(value === choice.value ? undefined : choice.value)}
          className={`min-h-10 rounded-full border px-3.5 py-1.5 text-sm font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${value === choice.value ? choice.on : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function Songs({ songs, artist }: { songs: string[]; artist: string }) {
  if (!songs.length) {
    return (
      <div>
        <p className="text-base text-stone-700">Choose a familiar recording together.</p>
        <Find href={youtube(`${artist} songs`)}>Find {artist} on YouTube</Find>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-semibold text-stone-700">Recordings to try</p>
      <ul className="mt-1 space-y-1 text-base text-stone-900">
        {songs.map((song) => (
          <li key={song} className="flex flex-wrap items-baseline gap-x-3">
            <span>{song}</span>
            <Find href={youtube(`${song} ${artist}`)}>Play on YouTube</Find>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-stone-500">Suggested by AI. Listen first to check it feels right.</p>
    </div>
  );
}

// Shown on every plan and printed with it: what to do if the session stops feeling good.
function CalmCard({ person, id }: { person: string; id: string }) {
  return (
    <aside aria-labelledby={id} className="mt-6 break-inside-avoid rounded-2xl border-l-4 border-amber-500 bg-amber-50/70 px-5 py-4">
      <h3 id={id} className="text-base font-semibold text-amber-950">If {person} seems upset</h3>
      <ul className="mt-2 space-y-1.5 text-base leading-relaxed text-stone-800">
        <li>Pause. Speak slowly and keep your voice calm and low.</li>
        <li>Name the feeling, not the facts: “That sounds hard. I’m right here.”</li>
        <li>Don’t correct or test memory. Gently move on, or go straight to the closing song.</li>
        <li>Ending early is fine. A few good minutes count. Afterwards, mark the item “Seemed uneasy” so the next plan leaves it out.</li>
      </ul>
    </aside>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-stone-100 px-4 py-3 text-base leading-relaxed text-stone-800"><span className="font-semibold">Tip: </span>{children}</p>;
}

type Props = {
  plan: Plan;
  firstName: string;
  seeds: Seed[];
  sessionNumber: number;
  birthYear: number;
  /** Present on the latest session only: hands the caregiver's feedback to the planning agent. */
  onPlanNext?: (feedback: Feedback[], note: string) => void;
  busy?: boolean;
  /** Reactions and note saved earlier on this device, and where to report changes to them. */
  draft?: Draft;
  onDraftChange?: (draft: Draft) => void;
  /** False when restoring a saved plan, so the page does not jump on load. */
  scrollOnMount?: boolean;
};
export type Draft = { reactions: Record<string, Reaction>; note: string };

export default function SessionPlan({ plan, firstName, seeds, sessionNumber, birthYear, onPlanNext, busy = false, draft, onDraftChange, scrollOnMount = true }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [reactions, setReactionsState] = useState<Record<string, Reaction>>(draft?.reactions ?? {});
  const [note, setNoteState] = useState(draft?.note ?? "");
  const setReaction = (entityId: string, next?: Reaction) => {
    const copy = { ...reactions };
    if (next) copy[entityId] = next; else delete copy[entityId];
    setReactionsState(copy);
    onDraftChange?.({ reactions: copy, note });
  };
  const setNote = (value: string) => {
    setNoteState(value);
    onDraftChange?.({ reactions, note: value });
  };
  // Only when a session first appears; a restored plan stays where the page is.
  const scrollOnFirstShow = useRef(scrollOnMount);
  useEffect(() => {
    if (!scrollOnFirstShow.current) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const name = firstName || "them";
  const topicMinutes = Math.round(15 / Math.max(1, plan.conversation.length));
  const entries = [plan.opening_song, ...plan.conversation, plan.sensory_activity, plan.closing];
  const items = [...new Map(entries.map((entry) => [entry.entity_id, entry])).values()];
  const marked = items.filter((entry) => reactions[entry.entity_id]).length;
  const react = (entry: { entity_id: string; item: string }) => onPlanNext ? (
    <ReactionPicker
      item={entry.item}
      person={name}
      value={reactions[entry.entity_id]}
      onChange={(next) => setReaction(entry.entity_id, next)}
    />
  ) : null;
  const submit = () => onPlanNext?.(
    items.filter((entry) => reactions[entry.entity_id]).map((entry) => ({ entity_id: entry.entity_id, name: entry.item, type: entry.type, reaction: reactions[entry.entity_id] })),
    note.trim(),
  );
  const headingId = `session-heading-${sessionNumber}`;

  return (
    <article aria-labelledby={headingId} className="border-t border-stone-200 bg-white pt-8 sm:rounded-3xl sm:border sm:border-teal-900/15 sm:p-8 print:border-0 print:p-0">
      <h2 id={headingId} ref={heading} tabIndex={-1} className="scroll-mt-6 text-3xl font-semibold tracking-tight text-stone-900 focus:outline-none">
        {sessionNumber === 1 ? `A 30-minute session for ${name}` : `Session ${sessionNumber} for ${name}`}
      </h2>
      {seeds.length ? <p className="mt-2 text-base text-stone-600">Built from their love of {joinNames(seeds.map((seed) => seed.name))}.</p> : null}
      <TimeBar />
      <CalmCard person={name} id={`${headingId}-calm`} />

      <div className="mt-8 space-y-8">
        <Part tone={TONE.music} minutes="0–5 min" title="Opening song">
          <Item name={plan.opening_song.item} kind={plan.opening_song.type} why={plan.opening_song.why_this} year={plan.opening_song.year} person={name} birthYear={birthYear} />
          <Songs songs={plan.opening_song.songs} artist={plan.opening_song.item} />
          <Tip>{plan.opening_song.caregiver_tip}</Tip>
          {react(plan.opening_song)}
        </Part>

        <Part tone={TONE.conversation} minutes="5–20 min" title="Conversation">
          <p className="text-base text-stone-600">
            About {topicMinutes} minutes for each. Read a question aloud, then follow where {name} takes it. There are no wrong answers.
          </p>
          {plan.conversation.map((topic) => (
            <div key={topic.entity_id} className="break-inside-avoid space-y-3 pt-2">
              <Item name={topic.item} kind={topic.type} why={topic.why_this} year={topic.year} person={name} birthYear={birthYear} />
              <ul aria-label={`Questions about ${topic.item}`} className="space-y-3">
                {topic.prompts.map((prompt) => (
                  <li key={prompt} className="border-l-2 border-teal-800/30 pl-4 font-serif text-[1.3rem] leading-snug text-stone-900">{prompt}</li>
                ))}
              </ul>
              <Find href={youtube(clipQuery(topic))}>{topic.type === "artist" ? `Find ${topic.item} on YouTube` : "Find a short clip on YouTube"}</Find>
              {react(topic)}
            </div>
          ))}
        </Part>

        <Part tone={TONE.sensory} minutes="20–25 min" title="Sensory activity">
          <Item name={plan.sensory_activity.item} kind={plan.sensory_activity.type} why={plan.sensory_activity.why_this} year={plan.sensory_activity.year} person={name} birthYear={birthYear} />
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
          {plan.sensory_activity.type !== "artist" ? <Find href={imageSearch(`${plan.sensory_activity.item}${plan.sensory_activity.year ? ` ${plan.sensory_activity.year}` : ""} ${plan.sensory_activity.type === "movie" ? "film" : "TV show"} stills`)}>Find photos to print</Find> : null}
          {react(plan.sensory_activity)}
        </Part>

        <Part tone={TONE.music} minutes="25–30 min" title="Closing song">
          <Item name={plan.closing.item} kind={plan.closing.type} why={plan.closing.why_this} year={plan.closing.year} person={name} birthYear={birthYear} />
          <Songs songs={plan.closing.songs} artist={plan.closing.item} />
          <Tip>{plan.closing.caregiver_tip}</Tip>
          {react(plan.closing)}
        </Part>
      </div>

      {onPlanNext ? (
        <section aria-labelledby={`${headingId}-after`} className="mt-8 rounded-2xl bg-teal-50/70 p-5 sm:p-6 print:hidden">
          <h3 id={`${headingId}-after`} className="text-lg font-semibold text-teal-950">After the session</h3>
          <p className="mt-1 text-base leading-relaxed text-teal-950/80">
            Mark how each item went above. The agent uses it to choose what the next session builds on, and what to leave out.
          </p>
          <label htmlFor={`${headingId}-note`} className="mt-4 block font-medium text-stone-800">Anything you noticed? <span className="font-normal text-stone-500">(optional)</span></label>
          <textarea
            id={`${headingId}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder={`e.g., ${name} hummed along to the trumpet`}
            className="mt-2 min-h-20 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:outline-none focus:ring-3 focus:ring-teal-700/15"
          />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!marked || busy}
              onClick={submit}
              className="min-h-12 rounded-xl bg-teal-800 px-5 py-3 text-base font-semibold text-white hover:bg-teal-900 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-teal-700 disabled:cursor-not-allowed"
            >
              {busy ? "Planning the next session…" : "Plan the next session"}
            </button>
            <p className="text-sm text-stone-600" aria-live="polite">{marked ? `${marked} of ${items.length} marked` : "Mark at least one item to continue."}</p>
          </div>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-stone-200 pt-6">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-12 rounded-xl border border-teal-800/30 px-5 py-3 text-base font-semibold text-teal-900 hover:bg-teal-50 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-teal-700 print:hidden"
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
