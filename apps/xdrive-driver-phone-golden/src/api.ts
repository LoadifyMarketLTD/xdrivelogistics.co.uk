import { config, assertRuntimeConfig } from "./config";
import type { DriverSession } from "./storage";
import type { DriverDocument, DriverJob, DriverPreferences, DriverProfile } from "./types";

type Json = Record<string, unknown>;

function parseError(raw: string, fallback: string): string {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Json;
    return (typeof parsed.error === "string" && parsed.error) || (typeof parsed.message === "string" && parsed.message) || fallback;
  } catch {
    return fallback;
  }
}

async function checkedJson(response: Response, fallback: string): Promise<Json> {
  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, fallback));
  return raw ? (JSON.parse(raw) as Json) : {};
}

export async function login(email: string, password: string): Promise<DriverSession> {
  assertRuntimeConfig();

  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const json = await checkedJson(response, "Login failed.");

  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : "";
  const user = (json.user ?? {}) as Json;
  const userId = typeof user.id === "string" ? user.id : "";
  const userEmail = typeof user.email === "string" ? user.email : email;

  if (!accessToken || !refreshToken || !userId) throw new Error("Login response missing required auth fields.");

  return { accessToken, refreshToken, userId, email: userEmail };
}

export async function loadDriverProfile(session: DriverSession): Promise<DriverProfile> {
  const query = `select=id,company_id&user_id=eq.${session.userId}&limit=1`;
  const response = await fetch(`${config.supabaseUrl}/rest/v1/drivers?${query}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to load driver profile."));

  const rows = (raw ? JSON.parse(raw) : []) as Json[];
  const first = rows[0] ?? {};
  const driverId = typeof first.id === "string" ? first.id : "";
  const companyId = typeof first.company_id === "string" ? first.company_id : "";
  if (!driverId || !companyId) throw new Error("Driver profile not found for this user.");
  return { driverId, companyId };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function loadAssignedJobs(session: DriverSession, driverId: string): Promise<DriverJob[]> {
  const select = "id,status,current_status,pickup_location,delivery_location,pickup_datetime,delivery_datetime,client_name,load_details,delivery_photos,pod_photos";
  const query = `select=${select}&assigned_driver_id=eq.${driverId}&order=pickup_datetime.asc&limit=50`;
  const response = await fetch(`${config.supabaseUrl}/rest/v1/jobs?${query}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to load assigned jobs."));

  const rows = (raw ? JSON.parse(raw) : []) as Json[];
  return rows.map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    status: typeof row.status === "string" ? row.status : "",
    currentStatus: typeof row.current_status === "string" ? row.current_status : "",
    pickupLocation: typeof row.pickup_location === "string" ? row.pickup_location : "",
    deliveryLocation: typeof row.delivery_location === "string" ? row.delivery_location : "",
    pickupDatetime: typeof row.pickup_datetime === "string" ? row.pickup_datetime : null,
    deliveryDatetime: typeof row.delivery_datetime === "string" ? row.delivery_datetime : null,
    clientName: typeof row.client_name === "string" ? row.client_name : "",
    loadDetails: typeof row.load_details === "string" ? row.load_details : "",
    deliveryPhotos: asStringArray(row.delivery_photos),
    podPhotos: asStringArray(row.pod_photos),
  }));
}

export async function loadDriverDocuments(session: DriverSession, driverId: string): Promise<DriverDocument[]> {
  const query = "select=id,doc_type,status,created_at&order=created_at.desc&limit=30";
  const response = await fetch(`${config.supabaseUrl}/rest/v1/driver_documents?driver_id=eq.${driverId}&${query}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to load driver documents."));

  const rows = (raw ? JSON.parse(raw) : []) as Json[];
  return rows.map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    docType: typeof row.doc_type === "string" ? row.doc_type : "",
    status: typeof row.status === "string" ? row.status : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  }));
}

export async function loadPreferences(session: DriverSession): Promise<DriverPreferences> {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const json = await checkedJson(response, "Failed to load preferences.");
  const metadata = ((json.user as Json | undefined)?.user_metadata ?? {}) as Json;

  return {
    notifyTracked: metadata.driver_notify_tracked === true,
    emailNotifications: metadata.driver_email_notifications === true,
  };
}

export async function savePreferences(session: DriverSession, prefs: DriverPreferences): Promise<void> {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        driver_notify_tracked: prefs.notifyTracked,
        driver_email_notifications: prefs.emailNotifications,
      },
    }),
  });

  await checkedJson(response, "Failed to save preferences.");
}

export async function sendQuickNote(session: DriverSession, jobId: string, note: string, important: boolean): Promise<void> {
  const response = await fetch(`${config.xdriveBaseUrl}/api/driver/jobs/${encodeURIComponent(jobId)}/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      note,
      visibility: important ? "important" : "internal",
    }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to send quick note."));
}

export async function updateJobStatus(session: DriverSession, driverId: string, jobId: string, nextStatus: string): Promise<void> {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(jobId)}&assigned_driver_id=eq.${encodeURIComponent(driverId)}`, {
    method: "PATCH",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: nextStatus,
      current_status: nextStatus,
      updated_at: new Date().toISOString(),
    }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to update job status."));

  const rows = (raw ? JSON.parse(raw) : []) as Json[];
  if (rows.length === 0) throw new Error("Status update could not be applied for this assignment.");
}

export async function publishLocation(session: DriverSession, lat: number, lng: number): Promise<void> {
  const response = await fetch(`${config.xdriveBaseUrl}/api/driver/location`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lat, lng, heading: null, speed_mph: null }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to publish location."));
}

export async function updatePassword(session: DriverSession, newPassword: string): Promise<void> {
  const response = await fetch(`${config.xdriveBaseUrl}/api/driver/password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newPassword }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(parseError(raw, "Failed to update password."));
}

export type PodUploadInput = {
  name: string;
  mimeType: string;
  uri: string;
};

export async function uploadPodDocument(
  session: DriverSession,
  driverId: string,
  job: DriverJob,
  input: PodUploadInput
): Promise<string> {
  const safeName = (input.name || "pod.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `driver-${driverId}/${job.id}/${Date.now()}-${safeName}`;

  const fileResponse = await fetch(input.uri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(`${config.supabaseUrl}/storage/v1/object/pod-docs/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "x-upsert": "false",
      "Content-Type": input.mimeType || "application/octet-stream",
    },
    body: blob,
  });

  const uploadRaw = await uploadResponse.text();
  if (!uploadResponse.ok) throw new Error(parseError(uploadRaw, "Failed to upload POD document."));

  const nextDeliveryPhotos = Array.from(new Set([...(job.deliveryPhotos ?? []), storagePath]));
  const nextPodPhotos = Array.from(new Set([...(job.podPhotos ?? []), storagePath]));

  const patchResponse = await fetch(`${config.supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}&assigned_driver_id=eq.${encodeURIComponent(driverId)}`, {
    method: "PATCH",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      delivery_photos: nextDeliveryPhotos,
      pod_photos: nextPodPhotos,
      updated_at: new Date().toISOString(),
    }),
  });

  const patchRaw = await patchResponse.text();
  if (!patchResponse.ok) throw new Error(parseError(patchRaw, "POD upload succeeded, but job update failed."));

  return storagePath;
}
