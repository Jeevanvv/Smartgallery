"use client";

import { useState } from "react";

type SearchPhoto = {
  id: string;
  thumbnail_url: string | null;
  drive_url: string | null;
  filename: string;
};

type SearchResult = {
  session_id: string;
  match_count: number;
  photos: SearchPhoto[];
};

type Props = {
  slug: string;
  ready: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export default function PublicEventSearch({ slug, ready }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a selfie first.");
      return;
    }
    if (!consentChecked) {
      setError("Please agree to the consent notice before searching.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("selfie", file);

    try {
      const res = await fetch(`${API_URL}/public/events/${slug}/search`, {
        method: "POST",
        body: formData,
      });

      const body = await res.json().catch(() => ({ detail: "Search failed" }));
      if (!res.ok) {
        throw new Error(body.detail ?? "Search failed");
      }

      setResult(body as SearchResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 sm:mt-10">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">Find my photos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload a clear selfie. It is used only for search and is not stored.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Privacy notice</p>
          <p className="mt-2">
            Your selfie is processed only to find matching event photos. It is not added to the
            gallery, and guests should upload only their own face or a face they are authorized to
            search for.
          </p>
        </div>

        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          disabled={!ready || loading}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="mt-4 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        />

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={consentChecked}
            disabled={!ready || loading}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            I confirm this selfie is mine or I have permission to use it for photo search, and I
            understand it will be processed only to find matching event photos.
          </span>
        </label>

        <button
          type="submit"
          disabled={!ready || loading || !consentChecked}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
        >
          {loading ? "Searching..." : "Search photos"}
        </button>

        {!ready && (
          <p className="mt-3 text-sm text-amber-700">
            This event is still indexing. Please try again once the photographer finishes setup.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="mt-8 text-left">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h3 className="text-xl font-semibold text-slate-900">Matches</h3>
            <p className="text-sm text-slate-500">{result.match_count} photos found</p>
          </div>

          {result.photos.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              No matches found yet. Try a brighter, front-facing selfie.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.photos.map((photo) => (
                <article
                  key={photo.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <img
                    src={`${API_URL}/public/events/${slug}/photos/${photo.id}/thumbnail`}
                    alt={photo.filename}
                    className="h-56 w-full object-cover"
                  />
                  <div className="p-4">
                    <p className="truncate text-sm font-medium text-slate-900">{photo.filename}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <a
                        href={`${API_URL}/public/events/${slug}/photos/${photo.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        Open
                      </a>
                      {photo.drive_url && (
                        <a
                          href={photo.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Drive
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
