import ProfileForm from "@/app/components/profile-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="flex items-center gap-3 border-b border-stone-200 py-6 sm:py-8 print:hidden">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-2xl bg-teal-800 text-lg font-semibold text-white"
        >
          R
        </span>
        <span className="text-lg font-semibold tracking-tight text-stone-900">
          Reminiscence Agent
        </span>
      </header>

      <main className="grid items-start gap-10 py-10 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 print:block print:py-0">
        <section aria-labelledby="welcome-heading" className="lg:sticky lg:top-10 print:hidden">
          <h1
            id="welcome-heading"
            className="max-w-lg text-4xl leading-tight font-semibold tracking-tight text-balance text-stone-900 sm:text-5xl lg:text-[3.2rem]"
          >
            {/* A non-breaking hyphen keeps "30-minute" on one line. */}
            Turn one favorite song into a 30{"\u2011"}minute conversation.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-600">
            For caregivers of people living with dementia. Name a singer or a film
            they love. We find the music, films and shows of their youth, leave out
            what might upset them, and write the questions.
          </p>
          <ol aria-label="How it works" className="mt-8 space-y-5 rounded-2xl border border-teal-900/10 bg-teal-50/80 p-6">
            <li className="flex gap-4">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-semibold text-white">1</span>
              <div>
                <p className="font-semibold text-teal-950">Tell us one or two favorites</p>
                <p className="mt-1 text-base leading-relaxed text-teal-950/80">A singer, a film or a TV show they love. A nickname is fine.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-semibold text-white">2</span>
              <div>
                <p className="font-semibold text-teal-950">We follow their taste back in time</p>
                <p className="mt-1 text-base leading-relaxed text-teal-950/80">
                  Qloo&apos;s taste graph finds what fans of those favorites also love,
                  from the years they were 10 to 30, the years people remember most.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-semibold text-white">3</span>
              <div>
                <p className="font-semibold text-teal-950">Run the session, then tell us how it went</p>
                <p className="mt-1 text-base leading-relaxed text-teal-950/80">
                  The next plan builds on what they enjoyed and leaves out what didn&apos;t land.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <ProfileForm currentYear={new Date().getFullYear()} />
      </main>

      <footer className="border-t border-stone-200 py-7 text-center text-sm text-stone-600 print:hidden">
        A conversation aid, not medical advice.
      </footer>
    </div>
  );
}
