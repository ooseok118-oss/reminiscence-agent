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
          <p className="mb-5 text-sm font-semibold tracking-widest text-teal-800">
            FOR CAREGIVERS &amp; FAMILIES
          </p>
          <h1
            id="welcome-heading"
            className="max-w-lg text-4xl leading-tight font-semibold tracking-tight text-stone-900 sm:text-5xl lg:text-[3.2rem]"
          >
            A little familiarity.
            <br />
            A meaningful connection.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-600">
            Start with what makes them smile. A favorite singer, a familiar film,
            a place they call home.
          </p>
          <div className="mt-8 rounded-2xl border border-teal-900/10 bg-teal-50/80 p-6">
            <p className="font-semibold text-teal-950">A gentle place to begin</p>
            <p className="mt-2 text-base leading-relaxed text-teal-950/80">
              You don&apos;t need their whole life story. A few favorites can open
              the door to a warm conversation.
            </p>
          </div>
        </section>

        <ProfileForm currentYear={new Date().getFullYear()} />
      </main>

      <footer className="border-t border-stone-200 py-7 text-center text-sm text-stone-600 print:hidden">
        A conversation aid, not medical advice.
      </footer>
    </div>
  );
}
