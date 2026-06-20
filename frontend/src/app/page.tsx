import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden">
      <header className="border-b border-[#e5d8c3]/80 bg-[#fffaf1]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="text-lg font-black tracking-tight text-[#17201d]">
            SmartGallery
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-[#d7c8af] bg-white/60 px-4 py-2 text-sm font-bold text-[#24483f] transition hover:border-[#24483f] hover:bg-white"
          >
            Photographer login
          </Link>
        </div>
      </header>

      <main className="soft-grid relative mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#d7c8af] bg-[#fffaf1]/80 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
              Face search for event photos
            </p>
            <h1 className="max-w-3xl text-balance text-5xl font-black leading-[0.95] tracking-tight text-[#17201d] sm:text-7xl">
              Guests find their photos with one selfie.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f6762]">
              SmartGallery turns a photographer&apos;s Google Drive folder into a private,
              searchable guest gallery. No guest accounts, no manual photo hunting, no
              new upload workflow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/admin"
                className="rounded-full bg-[#24483f] px-7 py-4 text-center text-sm font-black text-white shadow-xl shadow-[#24483f]/20 transition hover:bg-[#132b26]"
              >
                Open photographer dashboard
              </Link>
              <span className="text-sm font-medium text-[#6f756f]">
                Event links open directly at{" "}
                <code className="rounded-full bg-white/80 px-2 py-1">/event/name</code>
              </span>
            </div>
          </div>

          <div className="glass-card relative rounded-[2rem] p-5">
            <div className="rounded-[1.5rem] bg-[#17201d] p-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#f7d8bd]">Live event</p>
                  <h2 className="mt-2 text-2xl font-black">Wedding Gallery</h2>
                </div>
                <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-bold text-emerald-100">
                  Ready
                </span>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {["Sync", "Index", "Search"].map((step, index) => (
                  <div key={step} className="rounded-2xl bg-white/10 p-4">
                    <p className="text-3xl font-black">{index + 1}</p>
                    <p className="mt-3 text-sm text-white/75">{step}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-3xl bg-[#fffaf1] p-5 text-[#17201d]">
                <p className="text-sm font-black">Guest experience</p>
                <p className="mt-2 text-sm leading-6 text-[#5f6762]">
                  Open link, take selfie, download matched photos. The whole flow
                  is designed for a phone at the event.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Connect Drive", "Pick the event folder you already use for client delivery."],
            ["02", "Index in background", "Photos are scanned and queued while the dashboard shows progress."],
            ["03", "Share the link", "Guests search privately with a selfie and download their matches."],
          ].map(([number, title, copy]) => (
            <article key={title} className="glass-card rounded-[1.5rem] p-6">
              <p className="text-sm font-black text-[#d97742]">{number}</p>
              <h2 className="mt-4 text-xl font-black text-[#17201d]">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#5f6762]">{copy}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
