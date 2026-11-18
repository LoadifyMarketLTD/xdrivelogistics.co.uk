/** Authenticated company-document metadata only; never infer licence or regulatory eligibility. */
export type CompanyDocumentMetadata = {
  doc_type?: string | null;
  status?: string | null;
  expiry_date?: string | null;
};
const approved = new Set(['approved','verified','valid','compliant','active']);
const rejected = new Set(['rejected','revoked','invalid']);
const normal = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const expiryTime = (value: string | null | undefined): number | null =>
  value ? Date.parse(value.slice(0,10) + 'T23:59:59.999Z') : null;

export const documentIsApproved = (doc: CompanyDocumentMetadata, at = Date.now()): boolean => {
  const end = expiryTime(doc.expiry_date);
  return approved.has(normal(doc.status)) && (end === null || (Number.isFinite(end) && end >= at));
};
export const documentNeedsAction = (doc: CompanyDocumentMetadata, at = Date.now()): boolean => {
  const end = expiryTime(doc.expiry_date);
  return rejected.has(normal(doc.status)) || (end !== null && (!Number.isFinite(end) || end < at));
};
export const documentExpiresSoon = (doc: CompanyDocumentMetadata, at = Date.now()): boolean => {
  const end = expiryTime(doc.expiry_date);
  return end !== null && Number.isFinite(end) && end >= at && end <= at + 30*86400000;
};
export const documentSummary = (docs: CompanyDocumentMetadata[], restricted = false) => {
  if(restricted) return {label:'Not available',approved:0,needsAction:0,expiring:0};
  const approvedCount=docs.filter(doc=>documentIsApproved(doc)).length;
  const actionCount=docs.filter(doc=>documentNeedsAction(doc)).length;
  return {
    label: docs.length===0?'No document records'
      : actionCount ? `${actionCount} document(s) need action`
      : `${approvedCount} approved document(s)`,
    approved:approvedCount,needsAction:actionCount,
    expiring:docs.filter(doc=>documentExpiresSoon(doc)).length,
  };
};
export const driverDocumentStatus = (docs: CompanyDocumentMetadata[], category:'licence'|'cpc'|'identity', restricted=false): string => {
  if(restricted) return 'Restricted';
  const match=docs.filter(doc=>{
    const type=normal(doc.doc_type).replace(/[^a-z0-9]+/g,' ').trim();
    if(category==='licence')return /\b(licen[cs]e|driving licence)\b/.test(type);
    if(category==='cpc')return /\bcpc\b|certificate of professional competence/.test(type);
    return /\b(passport|identity|id card|identification)\b/.test(type);
  });
  if(!match.length)return 'Not recorded';
  if(match.some(doc=>documentIsApproved(doc)))return 'Approved';
  if(match.some(doc=>documentNeedsAction(doc)))return 'Action required';
  return 'Pending review';
};
