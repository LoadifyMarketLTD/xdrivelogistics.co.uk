export type CompanyStatusFilter =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'pending_approval'
  | 'rejected'
  | 'suspended'
  | 'all';

const isPendingStatus = (value: string) => value === 'pending' || value === 'pending_approval';

export const buildCompanySearchPattern = (search: string) => `%${search}%`;

export const applyCompanyStatusFilter = <T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, values: string[]) => T;
}>(query: T, status: CompanyStatusFilter) => {
  if (status === 'all') return query;
  if (isPendingStatus(status)) return query.in('status', ['pending', 'pending_approval']);
  return query.eq('status', status);
};

export const buildJobSearchPattern = (search: string) => `%${search}%`;
