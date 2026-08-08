const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export type Photographer = {
  id: string;
  name: string;
  email: string;
  has_drive_access: boolean;
  created_at: string;
};

export type EventSearchSession = {
  id: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  match_count: number;
  searched_at: string;
};
export type Event = {
  id: string;
  name: string;
  slug: string;
  drive_folder_id: string;
  status: string;
  photos_total: number;
  photos_indexed: number;
  photos_pending: number;
  photos_processing: number;
  photos_failed: number;
  search_count: number;
  last_searched_at: string | null;
  recent_searches: EventSearchSession[];
  public_url: string;
  created_at: string;
};

export type DashboardStats = {
  events_count: number;
  ready_events_count: number;
  photos_total: number;
  photos_indexed: number;
  searches_total: number;
  matches_total: number;
};

export type GuestSearch = {
  id: string;
  event_id: string;
  event_name: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  match_count: number;
  searched_at: string;
};
export type EventListResponse = {
  stats: DashboardStats;
  events: Event[];
  guest_searches: GuestSearch[];
};

export type EventSyncResult = {
  scanned: number;
  created: number;
  updated: number;
  deleted: number;
  queued: number;
  photos_total: number;
};

export type EventReindexResult = {
  queued: number;
  reset: number;
  photos_total: number;
};

export type DriveFolder = {
  id: string;
  name: string;
};

export type DriveFolderListResponse = {
  current_folder_id: string;
  current_folder_name: string;
  parent_folder_id: string | null;
  folders: DriveFolder[];
};

async function apiFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "API request failed");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function syncProfile(
  accessToken: string,
  tokens: { provider_token?: string; provider_refresh_token?: string }
) {
  return apiFetch<Photographer>("/auth/sync-profile", accessToken, {
    method: "POST",
    body: JSON.stringify(tokens),
  });
}

export async function getMe(accessToken: string) {
  return apiFetch<Photographer>("/auth/me", accessToken);
}

export async function listEvents(
  accessToken: string,
  status: "active" | "archived" | "all" = "active"
) {
  const query = status === "active" ? "" : `?status=${encodeURIComponent(status)}`;
  return apiFetch<EventListResponse>(`/events${query}`, accessToken);
}

export async function createEvent(
  accessToken: string,
  body: { name: string; slug?: string; drive_folder_id: string }
) {
  return apiFetch<Event>("/events", accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteEvent(accessToken: string, eventId: string) {
  return apiFetch<void>(`/events/${eventId}`, accessToken, { method: "DELETE" });
}

export async function deleteGuestSearch(accessToken: string, sessionId: string) {
  return apiFetch<void>(`/events/search-sessions/${sessionId}`, accessToken, {
    method: "DELETE",
  });
}

export async function restoreEvent(accessToken: string, eventId: string) {
  return apiFetch<Event>(`/events/${eventId}/restore`, accessToken, { method: "POST" });
}

export async function permanentlyDeleteEvent(accessToken: string, eventId: string) {
  return apiFetch<void>(`/events/${eventId}/permanent`, accessToken, { method: "DELETE" });
}

export async function syncEvent(accessToken: string, eventId: string) {
  return apiFetch<EventSyncResult>(`/events/${eventId}/sync`, accessToken, {
    method: "POST",
  });
}

export async function reindexEvent(accessToken: string, eventId: string) {
  return apiFetch<EventReindexResult>(`/events/${eventId}/reindex`, accessToken, {
    method: "POST",
  });
}

export async function listDriveFolders(accessToken: string, parentId?: string) {
  const query = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : "";
  return apiFetch<DriveFolderListResponse>(`/events/drive-folders${query}`, accessToken);
}
