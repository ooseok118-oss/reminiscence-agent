import type { Expansion, Seed } from "@/lib/qloo-types";

const labels = { movie: "Movies", tv_show: "TV shows", artist: "Music" };
const seedLabels = { movie: "Movie", tv_show: "TV show", artist: "Singer" };

export function RecognizedFavorites({ seeds }: { seeds: Seed[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-teal-800/20 bg-teal-50 p-5">
      <h3 className="font-semibold text-teal-950">Recognized favorites</h3>
      <ul className="mt-3 space-y-2 text-stone-700">
        {seeds.map((seed) => <li key={`${seed.type}-${seed.entity_id}`}>
          <strong>{seed.name}</strong>{seed.release_year ? ` (${seed.release_year})` : ""}
          <span className="block text-sm">{seedLabels[seed.type]}{seed.popularity !== null ? ` · Popularity ${seed.popularity.toFixed(3)}` : ""}</span>
        </li>)}
      </ul>
      <p className="mt-3 text-sm text-stone-600">Highest popularity within your chosen type. To change a match, edit its name or type above and search again.</p>
    </div>
  );
}

export default function QlooResults({ result }: { result: Expansion }) {
  return (
    <section aria-labelledby="qloo-heading" className="mt-8 border-t border-stone-200 pt-8">
      <p className="text-sm font-semibold text-teal-800">STEP 3 · QLOO DATA PREVIEW</p>
      <h2 id="qloo-heading" className="mt-2 text-2xl font-semibold">Connections from their favorites</h2>
      <p className="mt-3 text-stone-600">Reminiscence years: {result.era.from}–{result.era.to} (ages 10–30).</p>
      <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 leading-relaxed text-amber-950">
        Unfiltered source data. Topics to avoid are not applied to this raw list. Use the separate screening decisions and session plan above after they are ready.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-stone-600">Contribution scores describe connections to the starting favorites, not the probability of liking an item. Missing scores are not estimated.</p>
      <div className="mt-6 space-y-8">
        {result.categories.map((category) => (
          <section key={category.type} aria-labelledby={`category-${category.type}`}>
            <h3 id={`category-${category.type}`} className="text-xl font-semibold">{labels[category.type]} <span className="text-base font-normal text-stone-500">({category.items.length})</span></h3>
            <p className="mt-2 text-sm text-stone-600">
              {category.type === "artist" ? "Activity overlaps" : "Release years"}: {category.filters.from}–{category.filters.to}
              {category.filters.popularity !== null ? ` · Minimum popularity ${category.filters.popularity}` : " · No popularity minimum"}
            </p>
            {category.warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-900">{warning}</p>)}
            {category.error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-4 text-rose-900">{category.error} Submit again to retry.</p> : null}
            {!category.items.length && !category.error ? <p className="mt-3 text-stone-600">No matching results in this range. Try different favorites.</p> : null}
            <ol className="mt-4 space-y-4">
              {category.items.map((item, index) => (
                <li key={item.entity_id} className="rounded-2xl border border-stone-200 p-4">
                  <h4 className="text-lg font-semibold">{index + 1}. {item.name}{item.release_year ? ` (${item.release_year})` : ""}</h4>
                  {category.type === "artist" ? <p className="mt-1 text-sm text-stone-500">Active: {item.start_year ?? "unknown"}–{item.end_year ?? "ongoing (no end year supplied)"}</p> : null}
                  {item.description ? <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.description}</p> : null}
                  {item.why_this ? <p className="mt-3 text-sm font-medium text-teal-900">{item.why_this}</p> : <p className="mt-3 text-sm text-stone-500">Contribution scores unavailable.</p>}
                  {item.because_of.length ? <dl className="mt-2 space-y-1 text-sm">
                    {item.because_of.map((source) => <div key={source.entity_id} className="flex flex-wrap justify-between gap-x-4">
                      <dt className="text-stone-600">{source.name}</dt><dd className="font-mono tabular-nums text-stone-900">{source.score.toFixed(4)}</dd>
                    </div>)}
                  </dl> : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
