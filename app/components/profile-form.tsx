"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FavoriteType, Profile } from "@/lib/profile";
import type { Expansion, Seed } from "@/lib/qloo-types";
import QlooResults, { RecognizedFavorites } from "./qloo-results";
import type { PlanResponse, ReviewResponse } from "@/lib/plan-schema";
import PlanningResults from "./planning-results";
import AgentProgress, { type AgentStage } from "./agent-progress";

type FavoriteRow = { id: number; type: FavoriteType; name: string };

const favoriteTypes: { value: FavoriteType; label: string }[] = [
  { value: "artist", label: "Singer" },
  { value: "movie", label: "Movie" },
  { value: "tv_show", label: "TV show" },
];

const avoidOptions = ["War", "Loss of a spouse", "Hospitals"];
const fieldClass =
  "mt-2 min-h-13 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:outline-none focus:ring-3 focus:ring-teal-700/15";
const secondaryButtonClass =
  "min-h-11 rounded-xl border border-teal-800/25 px-4 py-2 text-base font-semibold text-teal-900 transition-colors hover:bg-teal-50 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-teal-700";

export default function ProfileForm({ currentYear }: { currentYear: number }) {
  const [firstName, setFirstName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [hometown, setHometown] = useState("");
  const [favorites, setFavorites] = useState<FavoriteRow[]>([
    { id: 1, type: "artist", name: "" },
    { id: 2, type: "movie", name: "" },
  ]);
  const [topicsToAvoid, setTopicsToAvoid] = useState<string[]>([]);
  const [otherTopicsToAvoid, setOtherTopicsToAvoid] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<AgentStage>("idle");
  const [failed, setFailed] = useState(false);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [result, setResult] = useState<Expansion | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [planned, setPlanned] = useState<PlanResponse | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const nextFavoriteId = useRef(3);

  function clearFeedback() {
    setError("");
    setProgress("");
    setStage("idle");
    setFailed(false);
    setSeeds([]);
    setResult(null);
    setReview(null);
    setPlanned(null);
  }

  function fillExample() {
    setFirstName("Mary");
    setBirthYear("1948");
    setHometown("Columbus, Ohio");
    setFavorites([
      { id: 1, type: "artist", name: "Elvis Presley" },
      { id: 2, type: "movie", name: "Roman Holiday" },
    ]);
    setTopicsToAvoid(["War"]);
    setOtherTopicsToAvoid("");
    clearFeedback();
  }

  function updateFavorite(id: number, patch: Partial<Omit<FavoriteRow, "id">>) {
    setFavorites((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addFavorite() {
    if (favorites.length >= 3) return;
    const id = nextFavoriteId.current++;
    const type =
      favoriteTypes.find((option) =>
        favorites.every((row) => row.type !== option.value),
      )?.value ?? "artist";
    setFavorites((rows) => [...rows, { id, type, name: "" }]);
    clearFeedback();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeRequest.current) return;
    clearFeedback();
    const form = event.currentTarget;
    const knownFavorites = favorites
      .filter((row) => row.name.trim())
      .map((row) => ({ type: row.type, name: row.name.trim() }));

    let invalidField = "";
    let message = "";
    if (!firstName.trim()) {
      invalidField = "firstName";
      message = "Please enter a first name or nickname.";
    } else if (!hometown.trim()) {
      invalidField = "hometown";
      message = "Please enter a hometown.";
    } else if (knownFavorites.length === 0) {
      invalidField = `favorite-name-${favorites[0].id}`;
      message = "Please add at least one favorite.";
    }

    if (message) {
      setError(message);
      (form.elements.namedItem(invalidField) as HTMLInputElement | null)?.focus();
      return;
    }

    const profile: Profile = {
      firstName: firstName.trim(),
      birthYear: Number(birthYear),
      hometown: hometown.trim(),
      knownFavorites,
      topicsToAvoid,
      otherTopicsToAvoid: otherTopicsToAvoid.trim(),
    };

    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    async function post<T>(path: string, body: unknown): Promise<T> {
      const response = await fetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error ?? "The server could not complete this request. Please try again.");
      return data as T;
    }
    try {
      setStage("resolve");
      setProgress("Finding their favorites in Qloo’s taste graph…");
      // Only favorite names/types and birth year are needed for Qloo.
      const resolved = await post<{ seeds: Seed[] }>("/api/resolve", { knownFavorites: profile.knownFavorites });
      setSeeds(resolved.seeds);
      setStage("expand");
      setProgress("Following their taste to films, TV and music. This usually takes 10 to 20 seconds.");
      const expanded = await post<Expansion>("/api/expand", { birthYear: profile.birthYear, seeds: resolved.seeds });
      setResult(expanded);
      setStage("review");
      setProgress("Checking topics to avoid…");
      const screened = await post<ReviewResponse>("/api/plan", { action: "review", profile, proof: expanded.proof });
      setReview(screened);
      setStage("plan");
      setProgress(`Checked topics to avoid. Writing a 30-minute session…`);
      let session: PlanResponse;
      try {
        session = await post<PlanResponse>("/api/plan", { action: "generate", receipt: screened.receipt });
      } catch (firstError) {
        // The reviewed pool is still valid, so one more planning try costs no extra screening.
        if (controller.signal.aborted) throw firstError;
        setProgress("Writing a 30-minute session. Taking one more pass…");
        session = await post<PlanResponse>("/api/plan", { action: "generate", receipt: screened.receipt });
      }
      setPlanned(session);
      setStage("done");
      setProgress("Your 30-minute session is ready.");
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "Unable to load results. Please try again.");
        setFailed(true);
        setProgress("");
      }
    } finally {
      activeRequest.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="profile-heading"
      className="min-w-0 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-medium text-teal-800">Let&apos;s get to know them</p>
          <h2 id="profile-heading" className="mt-2 text-3xl font-semibold tracking-tight">
            A few familiar favorites
          </h2>
        </div>
        <button type="button" disabled={busy} onClick={fillExample} className={secondaryButtonClass}>
          Try an example
        </button>
      </div>
      <p className="mt-4 text-base leading-relaxed text-stone-600 print:hidden">
        Tell us a little about the person you care for. A nickname is welcome.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone-500 print:hidden">Your favorites are checked with Qloo. Your profile and candidate items are sent to Gemini for screening and planning when you submit.</p>

      <form
        aria-busy={busy}
        className="mt-8 space-y-8 print:hidden"
        onSubmit={handleSubmit}
        onChange={clearFeedback}
        onInvalid={clearFeedback}
        method="post"
      >
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          <legend className="mb-4 text-lg font-semibold text-stone-900">About them</legend>
          <div className="grid gap-5 sm:grid-cols-[1fr_0.65fr]">
            <div>
              <label htmlFor="firstName" className="font-medium text-stone-800">
                First name or nickname
              </label>
              <input
                id="firstName"
                name="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={fieldClass}
                placeholder="e.g., Mary"
                autoComplete="off"
                maxLength={60}
                required
              />
            </div>
            <div>
              <label htmlFor="birthYear" className="font-medium text-stone-800">
                Birth year
              </label>
              <input
                id="birthYear"
                name="birthYear"
                type="number"
                inputMode="numeric"
                min={1900}
                max={currentYear}
                step={1}
                value={birthYear}
                onChange={(event) => setBirthYear(event.target.value)}
                className={fieldClass}
                placeholder="e.g., 1948"
                autoComplete="off"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="hometown" className="font-medium text-stone-800">
              Hometown
            </label>
            <input
              id="hometown"
              name="hometown"
              value={hometown}
              onChange={(event) => setHometown(event.target.value)}
              className={fieldClass}
              placeholder="e.g., Columbus, Ohio"
              autoComplete="off"
              maxLength={120}
              aria-describedby="hometown-hint"
              required
            />
            <p id="hometown-hint" className="mt-2 text-sm text-stone-500">
              The city and state where they grew up.
            </p>
          </div>
        </fieldset>

        <fieldset disabled={busy} className="min-w-0 border-t border-stone-200 pt-6">
          <legend className="pr-3 text-lg font-semibold text-stone-900">Known favorites</legend>
          <p id="favorites-hint" className="mb-5 text-base leading-relaxed text-stone-600">
            Add 1–3 favorites. Two or three from different categories work well,
            such as a singer and a movie.
          </p>
          <div className="space-y-5">
            {favorites.map((favorite, index) => (
              <div key={favorite.id} className="rounded-2xl bg-stone-50 p-4">
                <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-600">Favorite {index + 1}</p>
                  {favorites.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove favorite ${index + 1}`}
                      className="min-h-11 rounded-lg px-3 text-sm font-medium text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-3 focus-visible:outline-teal-700"
                      onClick={() => {
                        setFavorites((rows) => rows.filter((row) => row.id !== favorite.id));
                        clearFeedback();
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
                  <div>
                    <label htmlFor={`favorite-type-${favorite.id}`} className="font-medium text-stone-800">
                      Type
                      <span className="sr-only"> for favorite {index + 1}</span>
                    </label>
                    <select
                      id={`favorite-type-${favorite.id}`}
                      name={`favorite-type-${favorite.id}`}
                      value={favorite.type}
                      onChange={(event) =>
                        updateFavorite(favorite.id, { type: event.target.value as FavoriteType })
                      }
                      className={fieldClass}
                    >
                      {favoriteTypes.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`favorite-name-${favorite.id}`} className="font-medium text-stone-800">
                      Name
                      <span className="sr-only"> for favorite {index + 1}</span>
                    </label>
                    <input
                      id={`favorite-name-${favorite.id}`}
                      name={`favorite-name-${favorite.id}`}
                      value={favorite.name}
                      onChange={(event) => updateFavorite(favorite.id, { name: event.target.value })}
                      placeholder={favorite.type === "artist" ? "e.g., Elvis Presley" : favorite.type === "movie" ? "e.g., Roman Holiday" : "e.g., The Waltons"}
                      className={fieldClass}
                      maxLength={120}
                      autoComplete="off"
                      aria-describedby="favorites-hint"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {favorites.length < 3 ? (
            <button type="button" onClick={addFavorite} className={`${secondaryButtonClass} mt-4`}>
              + Add a favorite
            </button>
          ) : null}
        </fieldset>

        <fieldset disabled={busy} className="min-w-0 border-t border-stone-200 pt-6">
          <legend className="pr-3 text-lg font-semibold text-stone-900">
            Topics to avoid <span className="text-sm font-normal text-stone-500">(optional)</span>
          </legend>
          <p className="mb-4 text-base leading-relaxed text-stone-600">
            Let us know what to gently steer away from.
          </p>
          <div className="flex flex-wrap gap-3">
            {avoidOptions.map((topic) => (
              <label
                key={topic}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base ${topicsToAvoid.includes(topic) ? "border-teal-700 bg-teal-50 text-teal-950" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
              >
                <input
                  type="checkbox"
                  name="topicsToAvoid"
                  value={topic}
                  checked={topicsToAvoid.includes(topic)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setTopicsToAvoid((topics) => checked ? [...topics, topic] : topics.filter((item) => item !== topic));
                  }}
                  className="size-5 accent-teal-800 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-teal-700"
                />
                {topic}
              </label>
            ))}
          </div>
          <div className="mt-5">
            <label htmlFor="otherTopicsToAvoid" className="font-medium text-stone-800">
              Anything else to avoid?
            </label>
            <textarea
              id="otherTopicsToAvoid"
              name="otherTopicsToAvoid"
              value={otherTopicsToAvoid}
              onChange={(event) => setOtherTopicsToAvoid(event.target.value)}
              className={`${fieldClass} min-h-28 resize-y`}
              rows={3}
              maxLength={500}
              placeholder="e.g., a difficult family event"
            />
          </div>
        </fieldset>

        <div className="border-t border-stone-200 pt-6">
          <AgentProgress stage={stage} failed={failed} seeds={seeds} result={result} review={review} />
          {error ? <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-900">{error}</p> : null}
          <p role="status" aria-live="polite" className="sr-only">{progress}</p>
          <button
            type="submit"
            disabled={busy}
            className="min-h-14 w-full rounded-xl bg-teal-800 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-teal-700"
          >
            {busy ? "Building your session…" : "Build a gentle session"}
          </button>
        </div>
      </form>
      <PlanningResults review={review} planned={planned} firstName={firstName.trim()} seeds={seeds} />
      {result ? (
        <details className="mt-6 print:hidden">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-900">Everything Qloo found</summary>
          {seeds.length > 0 ? <RecognizedFavorites seeds={seeds} /> : null}
          <QlooResults result={result} />
        </details>
      ) : null}
    </section>
  );
}
