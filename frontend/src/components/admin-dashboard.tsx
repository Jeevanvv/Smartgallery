"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEvent,
  listDriveFolders,
  type DashboardStats,
  type DriveFolderListResponse,
  deleteEvent,
  listEvents,
  reindexEvent,
  syncEvent,
  syncProfile,
  type Event,
  type Photographer,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboard() {
  const supabase = createClient();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
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

      const eventData = await listEvents(session.access_token);
      setStats(eventData.stats);
      setEvents(eventData.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
      const eventData = await listEvents(session.access_token);
      setStats(eventData.stats);
      setEvents(eventData.events);
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
      const eventData = await listEvents(session.access_token);
      setStats(eventData.stats);
      setEvents(eventData.events);
      setNotice("Event archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
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
      const eventData = await listEvents(session.access_token);
      setStats(eventData.stats);
      setEvents(eventData.events);
      setNotice(
        `Drive sync finished: scanned ${result.scanned}, added ${result.created}, updated ${result.updated}.`
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
      const eventData = await listEvents(session.access_token);
      setStats(eventData.stats);
      setEvents(eventData.events);
      setNotice(
        `Queued ${result.queued} photos for indexing. Start the Celery worker to process them.`
      );
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

    setDrivePickerLoading(true);
    setError(null);
    try {
      const response = await listDriveFolders(session.access_token, parentId);
      setDrivePickerState(response);
      setDrivePickerOpen(true);
    } catch (err) {
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 sm:py-20">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          Photographer dashboard
        </h1>
        <p className="mb-8 text-slate-600">
          Sign in with Google to manage events and link your Drive folders.
        </p>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          onClick={handleSignIn}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your events</h1>
          <p className="mt-1 break-words text-sm text-slate-600">
            {photographer.name} · {photographer.email}
            {!photographer.has_drive_access && (
              <span className="ml-2 text-amber-600">
                (Drive access not granted — sign out and sign in again)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="self-start text-sm font-medium text-slate-600 hover:text-slate-900 sm:self-auto"
        >
          Sign out
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {stats && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Events</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.events_count}</p>
            <p className="mt-1 text-sm text-slate-600">{stats.ready_events_count} ready for guests</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Photos</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.photos_indexed}</p>
            <p className="mt-1 text-sm text-slate-600">{stats.photos_total} synced total</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Searches</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.searches_total}</p>
            <p className="mt-1 text-sm text-slate-600">Guest searches completed</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Matches</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.matches_total}</p>
            <p className="mt-1 text-sm text-slate-600">Photos returned across searches</p>
          </div>
        </section>
      )}

      <form
        onSubmit={handleCreateEvent}
        className="mb-10 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <h2 className="mb-4 font-semibold text-slate-900">Create new event</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Event name
            </label>
            <input
              type="text"
              required
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Wedding - Sharma Family"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Google Drive folder ID
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
              placeholder="1abc... from Drive folder URL"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => loadDriveFolders()}
                disabled={drivePickerLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
              >
                {drivePickerLoading ? "Loading folders..." : "Browse Drive"}
              </button>
              {selectedFolderName && (
                <p className="self-center text-sm text-slate-600">
                  Selected: <span className="font-medium text-slate-900">{selectedFolderName}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        {drivePickerOpen && drivePickerState && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Browsing: {drivePickerState.current_folder_name}
                </p>
                <p className="text-xs text-slate-500">{drivePickerState.current_folder_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {drivePickerState.parent_folder_id && (
                  <button
                    type="button"
                    onClick={() => loadDriveFolders(drivePickerState.parent_folder_id ?? undefined)}
                    disabled={drivePickerLoading}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
                  >
                    Up one level
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrivePickerOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {drivePickerState.folders.length === 0 ? (
                <p className="rounded-lg bg-white px-3 py-3 text-sm text-slate-500">
                  No subfolders found here.
                </p>
              ) : (
                drivePickerState.folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{folder.name}</p>
                      <p className="truncate text-xs text-slate-500">{folder.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadDriveFolders(folder.id)}
                        disabled={drivePickerLoading}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChooseFolder(folder.id, folder.name)}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={creating}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 sm:w-auto"
        >
          {creating ? "Creating…" : "Create event"}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="text-center text-slate-500">
          No events yet. Create your first event above.
        </p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{event.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {event.photos_indexed} / {event.photos_total} photos indexed
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pending {event.photos_pending} · Processing {event.photos_processing} · Failed{" "}
                    {event.photos_failed}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Searches {event.search_count}
                    {event.last_searched_at
                      ? ` · Last search ${new Date(event.last_searched_at).toLocaleString()}`
                      : " · No searches yet"}
                  </p>
                  <a
                    href={event.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block break-all text-sm text-indigo-600 hover:underline"
                  >
                    {event.public_url}
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <button
                    onClick={() => handleSyncEvent(event.id)}
                    disabled={syncingEventId === event.id}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    {syncingEventId === event.id ? "Syncing..." : "Sync photos"}
                  </button>
                  <button
                    onClick={() => handleReindexEvent(event.id)}
                    disabled={reindexingEventId === event.id}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                  >
                    {reindexingEventId === event.id ? "Queueing..." : "Reindex photos"}
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
