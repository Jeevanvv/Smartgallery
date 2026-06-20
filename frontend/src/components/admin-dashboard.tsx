"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEvent,
  listDriveFolders,
  type DashboardStats,
  type DriveFolderListResponse,
  deleteEvent,
  listEvents,
  permanentlyDeleteEvent,
  reindexEvent,
  restoreEvent,
  syncEvent,
  syncProfile,
  type Event,
  type Photographer,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

function progressPercent(event: Event) {
  if (!event.photos_total) return 0;
  return Math.round((event.photos_indexed / event.photos_total) * 100);
}

function eventStatus(event: Event) {
  if (event.status === "archived") {
    return { label: "Archived", className: "bg-stone-200 text-stone-700" };
  }
  if (event.photos_failed > 0) {
    return { label: "Needs review", className: "bg-amber-100 text-amber-800" };
  }
  if (event.photos_total > 0 && event.photos_indexed === event.photos_total) {
    return { label: "Guest ready", className: "bg-emerald-100 text-emerald-800" };
  }
  if (event.photos_processing > 0 || event.photos_pending > 0) {
    return { label: "Indexing", className: "bg-blue-100 text-blue-800" };
  }
  return { label: "Setup", className: "bg-stone-200 text-stone-700" };
}

export default function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventView, setEventView] = useState<"active" | "archived">("active");
  const eventViewRef = useRef<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);
  const [reindexingEventId, setReindexingEventId] = useState<string | null>(null);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [drivePickerLoading, setDrivePickerLoading] = useState(false);
  const [drivePickerState, setDrivePickerState] = useState<DriveFolderListResponse | null>(null);

  const [eventName, setEventName] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [selectedFolderName, setSelectedFolderName] = useState("");

  const readyPercent = useMemo(() => {
    if (!stats?.photos_total) return 0;
    return Math.round((stats.photos_indexed / stats.photos_total) * 100);
  }, [stats]);

  const hasActiveIndexing = useMemo(
    () => events.some((event) => event.photos_pending > 0 || event.photos_processing > 0),
    [events]
  );

  const refreshEventData = useCallback(
    async (silent = false, statusOverride?: "active" | "archived") => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (!silent) {
          setError("No active session. Please sign in again.");
        }
        return;
      }

      try {
        const eventData = await listEvents(session.access_token, statusOverride ?? eventViewRef.current);
        setStats(eventData.stats);
        setEvents(eventData.events);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Failed to refresh dashboard");
        }
      }
    },
    [supabase.auth]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setPhotographer(null);
      setStats(null);
      setEvents([]);
      setLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("No active session. Please sign in again.");
      setLoading(false);
      return;
    }

    const sessionWithProvider = session as typeof session & {
      provider_token?: string;
      provider_refresh_token?: string;
    };

    try {
      const profile = await syncProfile(session.access_token, {
        provider_token: sessionWithProvider.provider_token,
        provider_refresh_token: sessionWithProvider.provider_refresh_token,
      });
      setPhotographer(profile);

      await refreshEventData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [refreshEventData, supabase.auth]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    eventViewRef.current = eventView;
    if (photographer) {
      void refreshEventData(true, eventView);
    }
  }, [eventView, photographer, refreshEventData]);

  useEffect(() => {
    if (!photographer) return;

    const refreshIfVisible = () => {
      if (!document.hidden) {
        void refreshEventData(true);
      }
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshEventData(true);
      }
    };
    const intervalId = window.setInterval(refreshIfVisible, hasActiveIndexing ? 3000 : 15000);

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasActiveIndexing, photographer, refreshEventData]);

  useEffect(() => {
    if (!drivePickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrivePickerOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drivePickerOpen]);

  async function handleSignIn() {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "https://www.googleapis.com/auth/drive.readonly email profile openid",
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (signInError) {
      setError(signInError.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setPhotographer(null);
    setStats(null);
    setEvents([]);
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await createEvent(session.access_token, {
        name: eventName,
        drive_folder_id: driveFolderId,
      });
      setEventName("");
      setDriveFolderId("");
      setSelectedFolderName("");
      setEventView("active");
      await refreshEventData(false, "active");
      setNotice("Event created. Use Sync new photos when your Drive folder is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await deleteEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice("Event archived. You can restore or permanently delete it from Archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    }
  }

  async function handleRestoreEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await restoreEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice("Event restored and public link is active again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore event");
    }
  }

  async function handlePermanentDeleteEvent(eventId: string) {
    const confirmed = window.confirm(
      "Permanently delete this archived event and all synced photo records/search history? This cannot be undone."
    );
    if (!confirmed) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await permanentlyDeleteEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice("Archived event permanently deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to permanently delete event");
    }
  }

  async function handleSyncEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setSyncingEventId(eventId);
    setError(null);
    setNotice(null);
    try {
      const result = await syncEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice(
        `Drive sync finished: scanned ${result.scanned}, added ${result.created}, updated ${result.updated}, queued ${result.queued} for indexing.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync event photos");
    } finally {
      setSyncingEventId(null);
    }
  }

  async function handleReindexEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setReindexingEventId(eventId);
    setError(null);
    setNotice(null);
    try {
      const result = await reindexEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice(`Queued ${result.queued} photos for full reindex. Keep the Celery worker running.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue photo indexing");
    } finally {
      setReindexingEventId(null);
    }
  }

  async function loadDriveFolders(parentId?: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setDrivePickerOpen(true);
    setDrivePickerLoading(true);
    setError(null);
    try {
      const response = await listDriveFolders(session.access_token, parentId);
      setDrivePickerState(response);
    } catch (err) {
      setDrivePickerOpen(false);
      setError(err instanceof Error ? err.message : "Failed to browse Google Drive");
    } finally {
      setDrivePickerLoading(false);
    }
  }

  function handleChooseFolder(folderId: string, folderName: string) {
    setDriveFolderId(folderId);
    setSelectedFolderName(folderName);
    setDrivePickerOpen(false);
  }

  async function copyEventLink(url: string) {
    await navigator.clipboard.writeText(url);
    setNotice("Event link copied. Share it with guests when indexing is complete.");
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-5">
        <div className="glass-card rounded-[2rem] px-8 py-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#d97742]">
            Loading studio
          </p>
          <p className="mt-3 text-sm text-[#5f6762]">Preparing your event workspace...</p>
        </div>
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="mx-auto grid min-h-[82vh] max-w-6xl items-center gap-8 px-5 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="mb-5 inline-flex rounded-full bg-[#24483f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#24483f]">
            Photographer access
          </p>
          <h1 className="text-balance text-5xl font-black leading-tight text-[#17201d] sm:text-6xl">
            Turn a Drive folder into a client-ready photo finder.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#5f6762]">
            Sign in with Google, choose your event folder, and share one clean
            link where guests can find their photos by selfie.
          </p>
          {error && (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <button
            onClick={handleSignIn}
            className="mt-8 rounded-full bg-[#24483f] px-7 py-4 text-sm font-black text-white shadow-xl shadow-[#24483f]/20 transition hover:bg-[#132b26]"
          >
            Continue with Google
          </button>
        </div>
        <div className="glass-card rounded-[2rem] p-6">
          <div className="rounded-[1.5rem] bg-[#17201d] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f7d8bd]">
              MVP workflow
            </p>
            <div className="mt-6 space-y-4">
              {["Connect Google Drive", "Sync and index event photos", "Share the private guest link"].map(
                (item, index) => (
                  <div key={item} className="flex gap-4 rounded-2xl bg-white/10 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#17201d]">
                      {index + 1}
                    </span>
                    <p className="text-sm font-bold text-white/90">{item}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="soft-grid mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="inline-flex rounded-full bg-[#24483f]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#24483f]">
            Your event command center
          </p>
          <p className="mt-3 ml-2 break-words text-sm font-medium text-[#5f6762]">
            {photographer.name} - {photographer.email}
            {!photographer.has_drive_access && (
              <span className="ml-2 text-amber-700">
                Drive access needs reconnect.
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-fit rounded-full border border-[#d7c8af] bg-white/70 px-5 py-3 text-sm font-bold text-[#24483f] transition hover:border-[#24483f] hover:bg-white"
        >
          Sign out
        </button>
      </section>

      {error && (
        <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice}
        </p>
      )}

      {stats && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Events", stats.events_count, `${stats.ready_events_count} ready for guests`],
            ["Indexed", stats.photos_indexed, `${stats.photos_total} synced photos`],
            ["Searches", stats.searches_total, "Guest searches completed"],
            ["Matches", stats.matches_total, "Photos returned to guests"],
          ].map(([label, value, helper]) => (
            <div key={label} className="glass-card rounded-[1.5rem] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d97742]">
                {label}
              </p>
              <p className="mt-3 text-4xl font-black text-[#17201d]">{value}</p>
              <p className="mt-2 text-sm font-medium text-[#5f6762]">{helper}</p>
            </div>
          ))}
          <div className="glass-card rounded-[1.5rem] p-5 sm:col-span-2 xl:col-span-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d97742]">
                  Overall readiness
                </p>
                <p className="mt-2 text-sm font-medium text-[#5f6762]">
                  {readyPercent}% of synced photos are indexed.
                </p>
              </div>
              <p className="text-3xl font-black text-[#17201d]">{readyPercent}%</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e5d8c3]">
              <div
                className="h-full rounded-full bg-[#24483f]"
                style={{ width: `${readyPercent}%` }}
              />
            </div>
          </div>
        </section>
      )}

      <section className="mb-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={handleCreateEvent}
          className="glass-card rounded-[2rem] p-5 sm:p-6"
        >
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
            New event
          </p>
          <h2 className="mt-3 text-2xl font-black text-[#17201d]">
            Create a shareable gallery
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6762]">
            Pick a Drive folder with event photos. After creation, sync and index
            photos from the event card.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-black text-[#17201d]">
                Event name
              </label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Wedding - Sharma Family"
                className="w-full rounded-2xl border border-[#d7c8af] bg-white/80 px-4 py-3 text-sm font-medium outline-none transition placeholder:text-[#a8a094] focus:border-[#24483f] focus:ring-4 focus:ring-[#24483f]/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-[#17201d]">
                Google Drive folder
              </label>
              <input
                type="text"
                required
                value={driveFolderId}
                onChange={(e) => {
                  setDriveFolderId(e.target.value);
                  if (selectedFolderName) {
                    setSelectedFolderName("");
                  }
                }}
                placeholder="Paste folder ID or browse Drive"
                className="w-full rounded-2xl border border-[#d7c8af] bg-white/80 px-4 py-3 text-sm font-medium outline-none transition placeholder:text-[#a8a094] focus:border-[#24483f] focus:ring-4 focus:ring-[#24483f]/10"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => loadDriveFolders()}
                  disabled={drivePickerLoading}
                  className="rounded-full border border-[#d7c8af] bg-white/70 px-4 py-2 text-sm font-black text-[#24483f] transition hover:border-[#24483f] disabled:opacity-50"
                >
                  {drivePickerLoading ? "Loading folders..." : "Browse Drive"}
                </button>
                {selectedFolderName && (
                  <p className="self-center text-sm font-medium text-[#5f6762]">
                    Selected: <span className="font-black text-[#17201d]">{selectedFolderName}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-5 w-full rounded-full bg-[#24483f] px-5 py-4 text-sm font-black text-white shadow-xl shadow-[#24483f]/15 transition hover:bg-[#132b26] disabled:opacity-50 sm:w-auto"
          >
            {creating ? "Creating..." : "Create event"}
          </button>
        </form>

        <div className="glass-card rounded-[2rem] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
            Launch checklist
          </p>
          <h2 className="mt-3 text-2xl font-black text-[#17201d]">
            What makes an event guest-ready
          </h2>
          <div className="mt-5 space-y-3">
            {[
              "Drive folder selected",
              "Photos synced from Google Drive",
              "Indexing complete or mostly complete",
              "Public link copied and shared",
            ].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-white/65 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#24483f] text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-bold text-[#5f6762]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
              Events
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#17201d]">
              Client galleries
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-[#5f6762]">
              {eventView === "active"
                ? "Sync, index, and share each gallery from here."
                : "Restore old galleries or permanently remove archived records."}
            </p>
            <div className="rounded-full border border-[#d7c8af] bg-white/70 p-1">
              {(["active", "archived"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setEventView(view)}
                  className={`rounded-full px-4 py-2 text-xs font-black capitalize transition ${
                    eventView === view
                      ? "bg-[#24483f] text-white"
                      : "text-[#24483f] hover:bg-[#24483f]/10"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="glass-card rounded-[2rem] p-8 text-center">
            <h3 className="text-2xl font-black text-[#17201d]">
              {eventView === "active" ? "No active events yet." : "No archived events."}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5f6762]">
              {eventView === "active"
                ? "Create your first event above, then sync photos from the Drive folder."
                : "Archived events will appear here after you archive them."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {events.map((event) => {
              const status = eventStatus(event);
              const progress = progressPercent(event);

              return (
                <article key={event.id} className="glass-card rounded-[2rem] p-5 sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="break-words text-2xl font-black text-[#17201d]">
                          {event.name}
                        </h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white/65 p-4">
                          <p className="text-2xl font-black text-[#17201d]">
                            {event.photos_indexed}/{event.photos_total}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#6f756f]">
                            Indexed
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/65 p-4">
                          <p className="text-2xl font-black text-[#17201d]">
                            {event.search_count}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#6f756f]">
                            Searches
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/65 p-4">
                          <p className="text-2xl font-black text-[#17201d]">
                            {progress}%
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#6f756f]">
                            Ready
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e5d8c3]">
                        <div
                          className="h-full rounded-full bg-[#24483f]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs font-medium text-[#6f756f]">
                        Pending {event.photos_pending} - Processing {event.photos_processing} - Failed{" "}
                        {event.photos_failed}
                        {event.last_searched_at
                          ? ` - Last search ${new Date(event.last_searched_at).toLocaleString()}`
                          : " - No guest searches yet"}
                      </p>
                      {event.status === "active" ? (
                        <a
                          href={event.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block break-all text-sm font-black text-[#24483f] hover:underline"
                        >
                          {event.public_url}
                        </a>
                      ) : (
                        <p className="mt-3 break-all text-sm font-black text-[#6f756f]">
                          Public link disabled: {event.public_url}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-48">
                      {event.status === "active" ? (
                        <>
                          <button
                            onClick={() => copyEventLink(event.public_url)}
                            className="rounded-full border border-[#d7c8af] bg-white/70 px-5 py-3 text-sm font-black text-[#24483f] transition hover:border-[#24483f]"
                          >
                            Copy link
                          </button>
                          <button
                            onClick={() => handleSyncEvent(event.id)}
                            disabled={syncingEventId === event.id}
                            className="rounded-full bg-[#24483f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#132b26] disabled:opacity-50"
                          >
                            {syncingEventId === event.id ? "Syncing..." : "Sync new photos"}
                          </button>
                          <button
                            onClick={() => handleReindexEvent(event.id)}
                            disabled={reindexingEventId === event.id}
                            className="rounded-full bg-[#d97742] px-5 py-3 text-sm font-black text-white transition hover:bg-[#b85f30] disabled:opacity-50"
                          >
                            {reindexingEventId === event.id ? "Queueing..." : "Reindex all photos"}
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="rounded-full px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                          >
                            Archive
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRestoreEvent(event.id)}
                            className="rounded-full bg-[#24483f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#132b26]"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteEvent(event.id)}
                            className="rounded-full px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                          >
                            Delete forever
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {drivePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17201d]/55 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-picker-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDrivePickerOpen(false);
            }
          }}
        >
          <div className="glass-card flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem]">
            <div className="border-b border-[#e5d8c3] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d97742]">
                    Google Drive browser
                  </p>
                  <h2 id="drive-picker-title" className="mt-2 text-2xl font-black text-[#17201d]">
                    {drivePickerState?.current_folder_name ?? "Loading folders"}
                  </h2>
                  <p className="mt-1 break-all text-xs font-medium text-[#6f756f]">
                    {drivePickerState?.current_folder_id ??
                      "Choose the folder that contains this event's photos."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {drivePickerState?.parent_folder_id && (
                    <button
                      type="button"
                      onClick={() => loadDriveFolders(drivePickerState.parent_folder_id ?? undefined)}
                      disabled={drivePickerLoading}
                      className="rounded-full border border-[#d7c8af] bg-white/70 px-4 py-2 text-xs font-black text-[#24483f] hover:border-[#24483f] disabled:opacity-50"
                    >
                      Up one level
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrivePickerOpen(false)}
                    className="rounded-full border border-[#d7c8af] bg-white/70 px-4 py-2 text-xs font-black text-[#24483f] hover:border-[#24483f]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              {drivePickerLoading && !drivePickerState ? (
                <div className="rounded-2xl bg-white/70 px-4 py-8 text-center">
                  <p className="text-sm font-black text-[#17201d]">Loading your Drive folders...</p>
                  <p className="mt-2 text-sm font-medium text-[#5f6762]">
                    This usually takes just a moment.
                  </p>
                </div>
              ) : drivePickerState?.folders.length === 0 ? (
                <p className="rounded-2xl bg-white/70 px-4 py-4 text-sm font-medium text-[#5f6762]">
                  No subfolders found here.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {drivePickerState?.folders.map((folder) => (
                    <div key={folder.id} className="rounded-2xl bg-white/70 p-4">
                      <p className="truncate text-sm font-black text-[#17201d]">{folder.name}</p>
                      <p className="mt-1 truncate text-xs font-medium text-[#6f756f]">{folder.id}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => loadDriveFolders(folder.id)}
                          disabled={drivePickerLoading}
                          className="rounded-full border border-[#d7c8af] px-4 py-2 text-xs font-black text-[#24483f] hover:border-[#24483f] disabled:opacity-50"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChooseFolder(folder.id, folder.name)}
                          className="rounded-full bg-[#24483f] px-4 py-2 text-xs font-black text-white hover:bg-[#132b26]"
                        >
                          Select folder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
