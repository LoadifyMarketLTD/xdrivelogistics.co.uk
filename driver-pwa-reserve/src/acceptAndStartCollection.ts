export type AcceptAndDepartOutcome = {accepted: boolean; departed: boolean; reason?: string};

export async function acceptAndStartCollection(
  jobId: string,
  operations: {
    accept: () => Promise<Record<string,unknown>>;
    setStatus: (next: 'accepted' | 'on_my_way') => Promise<unknown>;
    readStatus: () => Promise<string>;
  }
): Promise<AcceptAndDepartOutcome> {
  // Contractual acceptance must succeed before transport statuses can change.
  const accepted = await operations.accept();
  if (accepted.success !== true || String(accepted.job_id||'') !== jobId) {
    return {accepted:false,departed:false,reason:'Acceptance response could not be verified; refresh the booking before starting.'};
  }
  const current = String(accepted.job_status||'').toLowerCase();
  if (current !== 'allocated' && current !== 'accepted' && current !== 'on_my_way') {
    return {accepted:true, departed:false, reason:'Booking accepted but a driver must be allocated before starting collection.'};
  }
  try {
    if (current === 'allocated') await operations.setStatus('accepted');
    if (current !== 'on_my_way') await operations.setStatus('on_my_way');
    const observed = (await operations.readStatus()).toLowerCase();
    if (observed !== 'on_my_way') {
      return {accepted:true,departed:false,reason:'Booking accepted, but transport status could not be confirmed. Refresh before continuing.'};
    }
    return {accepted:true,departed:true};
  } catch {
    // Do not retry acceptance or hide a partial success.
    return {accepted:true,departed:false,reason:'Booking accepted. Automatic departure was not confirmed; open the allocated booking and retry the transport status.'};
  }
}
