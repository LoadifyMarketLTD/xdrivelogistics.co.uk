import { supabase } from './supabaseClient';

const NOTE_REQUEST_TIMEOUT_MS = 12_000;

type SubmitJobNoteInput = {
  jobId: string;
  note: string;
  important?: boolean;
};

type SubmitJobNoteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitJobNote({ jobId, note, important = false }: SubmitJobNoteInput): Promise<SubmitJobNoteResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { ok: false, error: 'Session expired. Please sign in again.' };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), NOTE_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note,
        visibility: important ? 'important' : 'internal',
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Request timed out while sending note. Please try again.' };
    }
    return { ok: false, error: 'Network error while sending note.' };
  } finally {
    clearTimeout(timeoutHandle);
  }

  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const errorMessage = typeof payload.error === 'string' ? payload.error : 'Failed to send note.';
    return { ok: false, error: errorMessage };
  }

  return { ok: true };
}