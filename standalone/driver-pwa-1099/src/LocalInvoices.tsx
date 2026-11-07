import { useEffect, useState } from 'react'
import { formatGBP, invoiceTotals, validateInvoice, type InvoiceDraft } from './invoice'
import { readLocalRecords, writeLocalRecords } from './localRepository'

const key = 'xdrive-local-invoices-v1'
const valid = (v: unknown): v is InvoiceDraft => {
  if (!v || typeof v !== 'object') return false
  const d = v as Partial<InvoiceDraft>
  return typeof d.invoiceNumber === 'string' && d.invoiceNumber.startsWith('TEST-') &&
    typeof d.jobId === 'string' && d.jobId.startsWith('TEST-') &&
    typeof d.issuerName === 'string' && typeof d.customerName === 'string' &&
    typeof d.issuedOn === 'string' && typeof d.netPence === 'number' &&
    (d.vatRate === 0 || d.vatRate === 10 || d.vatRate === 20) &&
    typeof d.paymentTerms === 'string' && validateInvoice(d as InvoiceDraft) === null
}
type EligibleJob = { id: string; quote?: number; status: string }
export default function LocalInvoices({ jobs }: { jobs: EligibleJob[] }) {
  const [records, setRecords] = useState<InvoiceDraft[]>(() => readLocalRecords(key, valid))
  const eligible = jobs.filter(j => j.id.startsWith('TEST-') && j.status === 'DELIVERED' && Number.isFinite(j.quote))
  const [jobId, setJobId] = useState('')
  const [issuedOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [issuerName, setIssuerName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [vatRate, setVatRate] = useState<0 | 10 | 20>(0)
  const [paymentTerms, setPaymentTerms] = useState('End of calendar month')
  const [error, setError] = useState('')
  useEffect(() => writeLocalRecords(key, records), [records])
  const job = eligible.find(j => j.id === jobId)
  const draft: InvoiceDraft = {
    invoiceNumber: 'TEST-INV-' + (records.length + 1).toString().padStart(4, '0'),
    jobId,
    issuerName,
    customerName,
    issuedOn,
    netPence: job ? Math.round((job.quote ?? 0) * 100) : 0,
    vatRate,
    paymentTerms,
  }
  const totals = invoiceTotals(draft)
  const save = () => {
    const problem = validateInvoice(draft)
    if (problem) { setError(problem); return }
    if (!job || records.some(r => r.jobId === jobId)) { setError('Select a delivered test job without an existing invoice'); return }
    setRecords(previous => [...previous, draft])
    setJobId('')
    setError('')
  }
  return <section className="settings">
    <h2>Invoices — local test only</h2>
    <p>Draft records are stored only in this browser. They are not issued, emailed, uploaded, or synchronized.</p>
    <label>Completed test booking<select value={jobId} onChange={e => { setJobId(e.target.value); setError('') }}>
      <option value="">Select delivered job</option>
      {eligible.filter(j => !records.some(r => r.jobId === j.id)).map(j => <option key={j.id} value={j.id}>{j.id}</option>)}
    </select></label>
    <label>Issuer name<input value={issuerName} onChange={e => setIssuerName(e.target.value)} /></label>
    <label>Customer name<input value={customerName} onChange={e => setCustomerName(e.target.value)} /></label>
    <label>VAT rate<select value={vatRate} onChange={e => setVatRate(Number(e.target.value) as 0 | 10 | 20)}>
      <option value={0}>0% — local test</option><option value={10}>10% — local test</option><option value={20}>20% — local test</option>
    </select></label>
    <label>Payment terms<input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} /></label>
    <div className="breakdown">Net: {formatGBP(totals.netPence)} · VAT: {formatGBP(totals.vatPence)} · Gross: {formatGBP(totals.grossPence)}</div>
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={!jobId} onClick={save}>Save local test draft</button>
    <h2>Saved local drafts ({records.length})</h2>
    {records.length === 0 ? <p>No local invoice drafts.</p> : records.map(r => <article className="card" key={r.invoiceNumber}>
      <strong>{r.invoiceNumber}</strong><p>{r.jobId} · {r.customerName}</p>
      <p>{formatGBP(invoiceTotals(r).grossPence)} gross · VAT {r.vatRate}%</p>
      <small>Local draft — not a legal invoice</small>
    </article>)}
  </section>
}
