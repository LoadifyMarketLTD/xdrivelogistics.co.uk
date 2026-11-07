import { useEffect, useState } from "react";
import type { LiveSession } from "./liveApi";

type Document = { name: string; signedUrl: string };
const MAX_BYTES = 10 * 1024 * 1024;
const MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export default function BookingDocuments({ jobId, session, live }: { jobId: string; session: LiveSession | null; live: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const url = `/api/driver/web/jobs/${encodeURIComponent(jobId)}/evidence?kind=collection&category=documents`;
  const refresh = async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Could not load documents (${response.status})`);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load documents"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    setFiles([]); setDocuments([]); setError("");
    if (live && session?.token) void refresh(session.token);
  }, [jobId, live, session?.token]);
  const save = async () => {
    if (!session?.token || !files.length) return;
    setBusy(true); setError("");
    const completed: string[] = [];
    try {
      for (const file of files) {
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120)}`;
        const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(jobId)}/evidence`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}`, "Content-Type": file.type,
            "x-xdrive-evidence-kind": "collection", "x-xdrive-evidence-category": "documents", "x-xdrive-evidence-name": safeName },
          body: file,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`${file.name}: ${data.error || `upload failed (${response.status})`}`);
        completed.push(file.name);
      }
      setFiles([]);
      await refresh(session.token);
    } catch (e) {
      setFiles(previous => previous.filter(file => !completed.includes(file.name)));
      setError(e instanceof Error ? e.message : "Document upload failed");
      if (completed.length) await refresh(session.token);
    } finally { setBusy(false); }
  };
  if (!live) return <p>Document upload is available only for authenticated live bookings.</p>;
  return <div className="booking-documents">
    <h4>Attachments</h4>
    <label className="booking-attach-button">+ Attach document
      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={busy} onChange={event => {
        const chosen = Array.from(event.currentTarget.files || []);
        const invalid = chosen.find(file => !MIME.has(file.type) || file.size === 0 || file.size > MAX_BYTES);
        setError(invalid ? `${invalid.name}: use a PDF, JPG or PNG up to 10 MB.` : "");
        if (!invalid) setFiles(previous => [...previous, ...chosen]);
        event.currentTarget.value = "";
      }} />
    </label>
    {files.map((file, index) => <p key={`${file.name}-${index}`}>{file.name} - ready to upload</p>)}
    {files.length > 0 && <button type="button" className="primary" disabled={busy || !session?.token} onClick={() => void save()}>{busy ? "Uploading..." : "Save documents"}</button>}
    {loading && <p>Loading saved documents...</p>}
    {documents.map((document, index) => <p key={`${document.name}-${index}`}><a href={document.signedUrl} target="_blank" rel="noopener noreferrer">{document.name}</a> - saved securely</p>)}
    {error && <p role="alert">{error}</p>}
  </div>;
}
