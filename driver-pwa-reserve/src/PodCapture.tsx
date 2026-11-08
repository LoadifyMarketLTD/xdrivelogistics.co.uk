import { useEffect, useRef, useState } from 'react'
import PodDetails, { type PodForm } from './PodDetails'

const DATABASE = 'xdrive-reserve-local-pod-v2'
export type EvidenceStage = 'ARRIVED_PICKUP' | 'LOADED' | 'DELIVERED_POD' | 'OTHER'
type Evidence = { id: string; jobId: string; stage: EvidenceStage; name: string; type: string; size: number; capturedAt: string; recipient: string; file: File }
const stages: { value: EvidenceStage; label: string }[] = [
  { value: 'ARRIVED_PICKUP', label: 'Arrived to Pickup' },
  { value: 'LOADED', label: 'Loaded' },
  { value: 'DELIVERED_POD', label: 'Delivered / POD' },
  { value: 'OTHER', label: 'Other document' },
]
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('evidence')) {
        const store = request.result.createObjectStore('evidence', { keyPath: 'id' })
        store.createIndex('jobId', 'jobId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function readEvidence(jobId: string): Promise<Evidence[]> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('evidence').objectStore('evidence').index('jobId').getAll(jobId)
      req.onsuccess = () => resolve(req.result as Evidence[])
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}
async function storeEvidence(jobId: string, recipient: string, stage: EvidenceStage, files: File[]): Promise<void> {
  if (!jobId.startsWith('TEST-')) throw new Error('Only isolated test jobs are supported')
  if (stage === 'DELIVERED_POD' && !recipient.trim()) throw new Error('Recipient name is required for POD')
  if (!files.length) throw new Error('Select at least one document or photo')
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (files.some(f => !allowed.includes(f.type) || f.size === 0 || f.size > 12 * 1024 * 1024)) throw new Error('Use JPEG, PNG, WebP or PDF files up to 12 MB each')
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('evidence', 'readwrite')
      files.forEach(file => tx.objectStore('evidence').put({
        id: crypto.randomUUID(), jobId, recipient: recipient.trim(), stage, name: file.name,
        type: file.type, size: file.size, capturedAt: new Date().toISOString(), file,
      } satisfies Evidence))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
async function removeEvidence(id: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('evidence', 'readwrite')
      tx.objectStore('evidence').delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}
export default function PodCapture({ jobId, recipient, onSaved, initialStage = 'DELIVERED_POD', reference = '', initialItems = 1, onRecipient, onFormChange }: {
  jobId: string; recipient: string; onSaved: () => void; initialStage?: EvidenceStage; reference?: string; initialItems?: number; onRecipient?: (name:string)=>void; onFormChange?: (data:PodForm)=>void
}) {
  const [files, setFiles] = useState<File[]>([])
  const stage = initialStage
  const [expanded, setExpanded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const closeCamera = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCameraOpen(false) }
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()) }, [])
  useEffect(() => { if (cameraOpen && videoRef.current && streamRef.current) { videoRef.current.srcObject = streamRef.current; void videoRef.current.play() } }, [cameraOpen])
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera requires HTTPS or localhost')
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      setCameraOpen(true); setExpanded(false); setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Camera unavailable'); closeCamera() }
  }
  const takePhoto = async () => {
    const video = videoRef.current
    if (!video?.videoWidth) { setMessage('Wait for camera preview'); return }
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (blob) { setFiles(previous => [...previous, new File([blob], 'camera-' + crypto.randomUUID() + '.jpg', { type: 'image/jpeg' })]); closeCamera() }
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Evidence[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])
  useEffect(() => {
    readEvidence(jobId).then(result => { setItems(result); if (result.some(item => item.stage === 'DELIVERED_POD')) onSavedRef.current() }).catch(() => setMessage('Cannot read local documents'))
  }, [jobId])
  const refresh = async () => setItems(await readEvidence(jobId))
  const save = async () => {
    setBusy(true)
    try {
      await storeEvidence(jobId, recipient, stage, files)
      await refresh()
      setFiles([])
      setMessage('Documents saved locally in this browser; nothing was uploaded to XDrive.')
      if (stage === 'DELIVERED_POD') onSaved()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save evidence') }
    finally { setBusy(false) }
  }
  return <section className="settings evidence-panel" aria-label="Job evidence">
    {stage === 'DELIVERED_POD' && <PodDetails jobId={jobId} reference={reference} initialItems={initialItems} recipient={recipient} onRecipient={onRecipient || (()=>{})} onChange={onFormChange || (()=>{})} onSignature={file => setFiles(previous => [...previous.filter(f => !f.name.endsWith('-POD-signature.png')), file])} />}
    <div className="document-action-row"><button type="button" className="booking-yellow add-document-trigger" onClick={() => setExpanded(value => !value)}>Add Document</button>
      {expanded && <div className="document-source-picker" aria-label="Choose document source"><button type="button" onClick={() => void startCamera()}>Camera</button><button type="button" onClick={() => fileRef.current?.click()}>Image</button></div>}
    </div>
    {cameraOpen && <div className="live-camera"><video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" style={{width:"100%",maxHeight:"65vh",background:"#111"}} /><div className="document-source-picker"><button type="button" onClick={() => void takePhoto()}>Take Photo</button><button type="button" onClick={closeCamera}>Cancel</button></div></div>}
    <input ref={fileRef} hidden type="file" multiple accept="image/*,application/pdf" onChange={e => { setFiles(previous => [...previous, ...Array.from(e.target.files || [])]); setMessage(''); setExpanded(false) }} />
    {files.length > 0 && <div className="document-selected"><span>{files.map(file => file.name).join(', ')}</span><button type="button" disabled={busy || (stage === 'DELIVERED_POD' && !recipient.trim())} onClick={save}>{busy ? 'Saving…' : 'Save Document'}</button></div>}
    <small>JPEG, PNG, WebP or PDF; maximum 12 MB per file. Local test storage only.</small>
    {items.length > 0 && <div className="evidence-list"><strong>Saved evidence ({items.length})</strong>
      {items.map(item => <div className="evidence-item" key={item.id}>
        <span>{stages.find(s => s.value === item.stage)?.label}: {item.name} ({(item.size / 1024 / 1024).toFixed(2)} MB)</span>
        <button type="button" onClick={() => { const url = URL.createObjectURL(item.file); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000) }}>View</button>
        <button type="button" onClick={async () => { await removeEvidence(item.id); await refresh(); setMessage('Document deleted locally') }}>Remove</button>
      </div>)}
    </div>}
    {message && <p role="status">{message}</p>}
    <small>Reference examples: arrival photographs, loaded cargo, signed delivery notes and delivery POD. No remote upload, customer notification or automatic signature verification.</small>
  </section>
}
