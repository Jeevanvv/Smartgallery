import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-slate-900">
            SmartGallery
          </span>
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Photographer login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-indigo-600">
          Face recognition for event photography
        </p>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Find your photos in seconds
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600">
          Guests take a selfie and instantly see every photo from the event that
          features their face. Photographers keep using Google Drive — no new
          workflow.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/admin"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            I&apos;m a photographer
          </Link>
          <p className="text-sm text-slate-500">
            Have an event link? Open it directly — e.g.{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              /event/your-event
            </code>
          </p>
        </div>

        <div className="mt-20 grid gap-6 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 text-2xl">📸</div>
            <h2 className="mb-2 font-semibold text-slate-900">For photographers</h2>
            <p className="text-sm text-slate-600">
              Link a Google Drive folder. We index faces in the background and
              give you a shareable link for guests.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 text-2xl">👤</div>
            <h2 className="mb-2 font-semibold text-slate-900">For guests</h2>
            <p className="text-sm text-slate-600">
              No account needed. Take a selfie, get your photos. Your selfie is
              never stored.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 text-2xl">🤖</div>
            <h2 className="mb-2 font-semibold text-slate-900">Powered by AI</h2>
            <p className="text-sm text-slate-600">
              Open-source face recognition (InsightFace). No per-query API
              costs.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
