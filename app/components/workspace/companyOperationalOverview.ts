import type { WorkspaceDataState, WorkspaceJob } from './useCompanyWorkspaceData';
import { classifyWorkspaceJobStage, isCompanyExecutionJob, normalizedJobStatus } from '../../../lib/jobs/workspaceJobStage';
import { companyFleetDrivers } from './companyFleetRegister';
import { canonicalPodEvidence } from '../../../lib/pod/canonicalPodEvidence';
import { classifyAccountsDirection } from '../../../lib/finance/accounts';
import { isAwaitingPaymentInvoiceStatus, toCanonicalInvoiceDisplayStatus } from '../../../lib/invoiceStatus';

const lower = (x: unknown) => String(x ?? '').trim().toLowerCase();
const dateKey = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  // Match the operational calendar, not the browser's arbitrary local timezone.
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
};
const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
const newestFirst = (a: {updated_at:string}, b: {updated_at:string}) => (timestamp(b.updated_at)||0)-(timestamp(a.updated_at)||0);

export type CompanyOpsInput = Pick<WorkspaceDataState,'companyId'|'jobs'|'bids'|'drivers'|'vehicles'|'invoices'>;
export function deriveCompanyOperationalOverview(data: CompanyOpsInput, now = new Date()) {
  const companyId=data.companyId;
  const companyJobs=companyId?data.jobs.filter(j=>j.company_id===companyId||isCompanyExecutionJob(j,companyId)):[];
  const own=companyJobs.filter(j=>j.company_id===companyId);
  const executive=companyJobs.filter(j=>isCompanyExecutionJob(j,companyId));
  const openLoads=own.filter(j=>['posted','quoted'].includes(normalizedJobStatus(j))&&classifyWorkspaceJobStage(j)==='open');
  const active=executive.filter(j=>classifyWorkspaceJobStage(j)==='in_progress');
  const unallocated=executive.filter(j=>['awarded','allocated'].includes(classifyWorkspaceJobStage(j))&&!j.assigned_driver_id);
  const availableDrivers=companyFleetDrivers(data,'available');
  const pod=executive.filter(j=>classifyWorkspaceJobStage(j)==='completed'&&['missing','incomplete','rejected','missing_requested'].includes(canonicalPodEvidence(j).state));
  const overdue=active.filter(j=>Number.isFinite(timestamp(j.delivery_datetime))&&timestamp(j.delivery_datetime)<now.getTime());
  const ownOpenIds=new Set(openLoads.map(j=>j.id));
  const receivedQuotes=companyId?data.bids.filter(b=>ownOpenIds.has(b.job_id)&&Boolean(b.company_id)&&b.company_id!==companyId&&['submitted','viewed','shortlisted'].includes(lower(b.status))&&!b.poster_archived_at):[];
  const quoteLoadIds=new Set(receivedQuotes.map(b=>b.job_id));
  const quotesToReview=openLoads.filter(j=>quoteLoadIds.has(j.id));
  const today=dateKey(now);
  const todayJobs=executive.filter(j=>!['cancelled','expired','open','unknown'].includes(classifyWorkspaceJobStage(j))&&(dateKey(j.pickup_datetime)===today||dateKey(j.delivery_datetime)===today)).sort((a,b)=>(timestamp(a.pickup_datetime)||0)-(timestamp(b.pickup_datetime)||0));
  const receivables=companyId?data.invoices.filter(i=>classifyAccountsDirection(i,companyId)==='receivable'&&isAwaitingPaymentInvoiceStatus(toCanonicalInvoiceDisplayStatus(i.status,i.due_date,i.payment_status))):[];
  const recent=companyJobs.filter(j=>Number.isFinite(timestamp(j.updated_at))).sort(newestFirst);
  const start=now.getTime()-7*86_400_000;
  const sevenDays=own.filter(j=>timestamp(j.created_at)>=start&&timestamp(j.created_at)<=now.getTime());
  const posted=sevenDays.filter(j=>normalizedJobStatus(j)!=='draft');
  const quotedIds=new Set(data.bids.filter(b=>b.company_id!==companyId&&Boolean(b.company_id)).map(b=>b.job_id));
  const booked=posted.filter(j=>['awarded','allocated','in_progress','completed'].includes(classifyWorkspaceJobStage(j)));
  const completed=posted.filter(j=>classifyWorkspaceJobStage(j)==='completed');
  return {openLoads,active,unallocated,availableDrivers,pod,overdue,receivedQuotes,quotesToReview,todayJobs,receivables,recent,vehicles:companyId?data.vehicles:[],drivers:companyId?data.drivers:[],loadOverview:{posted:posted.length,quoted:posted.filter(j=>quotedIds.has(j.id)).length,booked:booked.length,completed:completed.length}};
}
export const companyJobReference = (job:WorkspaceJob) => job.booking_reference || job.load_reference || job.load_ref || job.customer_reference || job.id;
