export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:p-14">
        <p className="mb-6 text-sm font-semibold tracking-widest text-teal-800">
          REMINISCENCE AGENT
        </p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-stone-900 sm:text-5xl">
          A little familiarity.
          <br />
          A meaningful connection.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600">
          A space for caregivers and families to build warm conversations around
          the music, films, and memories someone loves.
        </p>
        <p className="mt-8 inline-flex rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900">
          Coming soon
        </p>
        <footer className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-600">
          A conversation aid, not medical advice.
        </footer>
      </div>
    </main>
  );
}
