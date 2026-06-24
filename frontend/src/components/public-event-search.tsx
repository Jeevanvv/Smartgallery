"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

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
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventActive, setEventActive] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guestDetailsReady =
    guestName.trim().length > 0 &&
    guestPhone.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());

  useEffect(() => {
    return () => {
      stopCamera();
      if (selfiePreviewUrl) {
        URL.revokeObjectURL(selfiePreviewUrl);
      }
    };
  }, [selfiePreviewUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) {
      return;
    }

    video.srcObject = stream;
    const markReady = () => setCameraReady(true);
    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("canplay", markReady);
    video.play().catch((err) => {
      setError(err instanceof Error ? err.message : "Camera preview could not start.");
    });

    return () => {
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("canplay", markReady);
      video.srcObject = null;
    };
  }, [cameraOpen]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraReady(false);
  }

  function setSelfieFile(nextFile: File | null) {
    if (selfiePreviewUrl) {
      URL.revokeObjectURL(selfiePreviewUrl);
    }
    setFile(nextFile);
    setSelfiePreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    setResult(null);
  }

  async function startCamera() {
    if (!guestDetailsReady) {
      setError("Enter your name, phone number, and email before taking a selfie.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera capture is not available in this browser. Choose a selfie file instead.");
      return;
    }

    setCameraStarting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission was denied.");
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!cameraReady || !video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture selfie from camera.");
      return;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture selfie from camera.");
          return;
        }
        setSelfieFile(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  async function ensureEventActive() {
    const res = await fetch(`${API_URL}/public/events/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      setEventActive(false);
      setResult(null);
      stopCamera();
      return false;
    }
    setEventActive(true);
    return true;
  }

  useEffect(() => {
    let cancelled = false;

    const checkActive = async () => {
      const res = await fetch(`${API_URL}/public/events/${slug}`, { cache: "no-store" });
      if (!cancelled && !res.ok) {
        setEventActive(false);
        setResult(null);
        stopCamera();
      }
    };
    const handleFocus = () => {
      void checkActive();
    };
    const intervalId = window.setInterval(checkActive, 15000);

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestDetailsReady) {
      setError("Enter your name, phone number, and email before searching.");
      return;
    }
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

    const active = await ensureEventActive();
    if (!active) {
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("guest_name", guestName.trim());
    formData.append("guest_phone", guestPhone.trim());
    formData.append("guest_email", guestEmail.trim().toLowerCase());
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

      const searchResult = body as SearchResult;
      setResult(searchResult);
      window.dispatchEvent(new Event(`smartgallery:search-complete:${slug}`));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  if (!eventActive) {
    return (
      <div className="glass-card rounded-[2rem] p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-[#d97742]">
          Not active
        </p>
        <h2 className="mt-3 text-3xl font-black text-[#17201d]">
          This event link is no longer active.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#5f6762]">
          Please check with your photographer for the latest gallery link.
        </p>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="glass-card rounded-[2rem] p-5 text-left sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
              Find my photos
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#17201d]">
              Start with a clear selfie
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#5f6762]">
              Use the camera for the fastest search, or upload a bright front-facing
              photo from your phone.
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
              ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {ready ? "Ready to search" : "Still indexing"}
          </span>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-[#e5d8c3] bg-white/65 p-4 text-sm leading-6 text-[#5f6762]">
          <p className="font-black text-[#17201d]">Privacy promise</p>
          <p className="mt-2">
            Your selfie is processed only to find matching event photos. It is not
            added to the gallery, and guests should search only with their own face
            or a face they are allowed to use.
          </p>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-[#e5d8c3] bg-white/75 p-4">
          <p className="text-sm font-black text-[#17201d]">Your details</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#6f756f]">
                Full name
              </label>
              <input
                type="text"
                required
                value={guestName}
                disabled={!eventActive || !ready || loading}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-[#d7c8af] bg-white px-4 py-3 text-sm font-medium text-[#17201d] outline-none transition placeholder:text-[#a8a094] focus:border-[#24483f] focus:ring-4 focus:ring-[#24483f]/10 disabled:bg-[#f3eee6]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#6f756f]">
                Phone
              </label>
              <input
                type="tel"
                required
                value={guestPhone}
                disabled={!eventActive || !ready || loading}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Mobile number"
                className="w-full rounded-2xl border border-[#d7c8af] bg-white px-4 py-3 text-sm font-medium text-[#17201d] outline-none transition placeholder:text-[#a8a094] focus:border-[#24483f] focus:ring-4 focus:ring-[#24483f]/10 disabled:bg-[#f3eee6]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#6f756f]">
                Email
              </label>
              <input
                type="email"
                required
                value={guestEmail}
                disabled={!eventActive || !ready || loading}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-[#d7c8af] bg-white px-4 py-3 text-sm font-medium text-[#17201d] outline-none transition placeholder:text-[#a8a094] focus:border-[#24483f] focus:ring-4 focus:ring-[#24483f]/10 disabled:bg-[#f3eee6]"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
          <button
            type="button"
            disabled={!eventActive || !ready || loading || cameraStarting || !guestDetailsReady}
            onClick={cameraOpen ? stopCamera : startCamera}
            className="rounded-full bg-[#24483f] px-6 py-4 text-sm font-black text-white shadow-xl shadow-[#24483f]/15 transition hover:bg-[#132b26] disabled:cursor-not-allowed disabled:bg-[#c8c1b6]"
          >
            {cameraOpen ? "Close camera" : cameraStarting ? "Opening camera..." : "Take selfie"}
          </button>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-full border border-[#d7c8af] bg-white/75 px-5 py-4 text-sm font-bold text-[#5f6762] transition hover:border-[#24483f]">
            <span className="truncate">{file ? file.name : "Or upload a selfie file"}</span>
            <span className="shrink-0 text-[#24483f]">Browse</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              capture="user"
              disabled={!eventActive || !ready || loading || !guestDetailsReady}
              onChange={(e) => {
                setSelfieFile(e.target.files?.[0] ?? null);
              }}
              className="sr-only"
            />
          </label>
        </div>

        {cameraOpen && (
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#17201d] bg-[#030712]">
            <div className="relative">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="aspect-[4/3] w-full -scale-x-100 object-cover"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#030712] text-sm font-black text-white">
                  Starting camera...
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-8 top-8 h-20 rounded-t-full border-x-2 border-t-2 border-white/45" />
            </div>
            <div className="flex flex-wrap gap-3 bg-[#fffaf1] p-4">
              <button
                type="button"
                onClick={captureSelfie}
                disabled={!cameraReady}
                className="rounded-full bg-[#d97742] px-6 py-3 text-sm font-black text-white transition hover:bg-[#b85f30] disabled:cursor-not-allowed disabled:bg-[#c8c1b6]"
              >
                Capture selfie
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full border border-[#d7c8af] px-6 py-3 text-sm font-black text-[#24483f] transition hover:border-[#24483f]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {selfiePreviewUrl && (
          <div className="mt-5 flex flex-col gap-4 rounded-[1.5rem] border border-[#e5d8c3] bg-white/65 p-4 sm:flex-row sm:items-center">
            <img
              src={selfiePreviewUrl}
              alt="Selected selfie preview"
              className="h-28 w-28 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#17201d]">{file?.name}</p>
              <p className="mt-1 text-sm font-medium text-[#5f6762]">
                Looks good. Confirm consent and start search.
              </p>
            </div>
          </div>
        )}

        <label className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-[#e5d8c3] bg-white/75 p-4 text-sm font-medium leading-6 text-[#5f6762]">
          <input
            type="checkbox"
            checked={consentChecked}
            disabled={!eventActive || !ready || loading || !guestDetailsReady}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#d7c8af] text-[#24483f] focus:ring-[#24483f]"
          />
          <span>
            I confirm this selfie is mine or I have permission to use it, and I
            understand it will be processed only to find matching event photos.
          </span>
        </label>

        <button
          type="submit"
          disabled={!eventActive || !ready || loading || !guestDetailsReady || !consentChecked || !file}
          className="mt-5 w-full rounded-full bg-[#24483f] px-6 py-4 text-sm font-black text-white shadow-xl shadow-[#24483f]/15 transition hover:bg-[#132b26] disabled:cursor-not-allowed disabled:bg-[#c8c1b6] sm:w-auto"
        >
          {loading ? "Searching your gallery..." : "Search my photos"}
        </button>

        {!ready && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            This event is still indexing. Please try again once the photographer finishes setup.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="mt-8 text-left lg:w-[calc(100vw-3rem)] lg:max-w-6xl">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
                Matches
              </p>
              <h3 className="mt-2 text-3xl font-black text-[#17201d]">
                {result.match_count} photos found
              </h3>
            </div>
            <p className="text-sm font-medium text-[#5f6762]">
              Open a photo to download the original.
            </p>
          </div>

          {result.photos.length === 0 ? (
            <div className="glass-card rounded-[2rem] p-8 text-center">
              <h4 className="text-2xl font-black text-[#17201d]">No matches yet.</h4>
              <p className="mt-2 text-sm leading-6 text-[#5f6762]">
                Try a brighter, front-facing selfie where your face is clear.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {result.photos.map((photo) => (
                <article
                  key={photo.id}
                  className="group overflow-hidden rounded-[1.75rem] border border-[#e5d8c3] bg-[#fffaf1]/85 shadow-xl shadow-[#24483f]/10"
                >
                  <div className="overflow-hidden bg-[#17201d]">
                    <img
                      src={`${API_URL}/public/events/${slug}/photos/${photo.id}/thumbnail`}
                      alt={photo.filename}
                      className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <p className="truncate text-sm font-black text-[#17201d]">{photo.filename}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a
                        href={`${API_URL}/public/events/${slug}/photos/${photo.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-[#24483f] px-4 py-2 text-sm font-black text-white transition hover:bg-[#132b26]"
                      >
                        Open photo
                      </a>
                      {photo.drive_url && (
                        <a
                          href={photo.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-[#d7c8af] px-4 py-2 text-sm font-black text-[#24483f] transition hover:border-[#24483f]"
                        >
                          View in Drive
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
