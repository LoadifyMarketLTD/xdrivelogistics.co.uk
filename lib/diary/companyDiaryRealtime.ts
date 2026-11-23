/** Only refresh an operational Diary for events involving its company or a job already shown. */
export type DiaryJobChange = {
  id?: string | null;
  company_id?: string | null;
  assigned_company_id?: string | null;
  awarded_carrier_company_id?: string | null;
};

export function isCompanyDiaryJobChangeRelevant(
  companyId: string,
  knownJobIds: ReadonlySet<string>,
  current?: DiaryJobChange | null,
  previous?: DiaryJobChange | null,
): boolean {
  if (!companyId) return false;
  return [current, previous].some((job) => Boolean(job && (
    job.company_id === companyId
    || job.assigned_company_id === companyId
    || job.awarded_carrier_company_id === companyId
    || (job.id && knownJobIds.has(job.id))
  )));
}
