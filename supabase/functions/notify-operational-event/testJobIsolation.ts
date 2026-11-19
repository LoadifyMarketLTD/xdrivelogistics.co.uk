type QueueEntity = { entity_type: string; entity_id: string; payload: Record<string, unknown> };
type Lookup = {
  job: (id: string) => Promise<{is_test: boolean | null} | null>;
  bid: (id: string) => Promise<{job_id: string | null} | null>;
  invoice: (id: string) => Promise<{job_id: string | null} | null>;
};
export async function suppressTestJobNotification(event: QueueEntity, lookup: Lookup): Promise<boolean> {
  let jobId: string | null = null;
  if (event.entity_type === 'job') {
    jobId = event.entity_id;
  } else if (event.entity_type === 'bid') {
    const bid = await lookup.bid(event.entity_id);
    if (!bid?.job_id) throw new Error('Cannot verify job for bid notification.');
    jobId = bid.job_id;
  } else if (event.entity_type === 'invoice') {
    const invoice = await lookup.invoice(event.entity_id);
    if (!invoice) throw new Error('Cannot verify invoice notification.');
    jobId = invoice.job_id;
  } else {
    return false;
  }
  if (!jobId) {
    if (event.entity_type === 'invoice' && !event.payload.job_id) return false;
    throw new Error('Cannot verify notification job identity.');
  }
  if (event.payload.job_id != null && event.payload.job_id !== jobId) {
    throw new Error('Notification job identity mismatch.');
  }
  const job = await lookup.job(jobId);
  if (!job || typeof job.is_test !== 'boolean') throw new Error('Cannot verify notification job test status.');
  return job.is_test;
}