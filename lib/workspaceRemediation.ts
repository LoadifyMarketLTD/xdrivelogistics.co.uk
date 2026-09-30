export type PostingWorkspace = 'admin' | 'customer' | 'broker' | 'owner';
const legalRoutes: Record<PostingWorkspace, string> = {
  admin: '/admin/settings/legal-agreements',
  customer: '/customer/account/legal-agreements',
  broker: '/broker/account/legal-agreements',
  owner: '/driver/account/legal-agreements',
};
/** Only a server-provided self-remediation destination enables this action.
 * Missing URLs describe counterparty gates and must not open our own agreements.
 * Owner-driver submissions use admin API mode, but retain the driver workspace.
 */
export function resolveLegalRemediationUrl(setupUrl: unknown, mode: PostingWorkspace): string | null {
  if (typeof setupUrl !== 'string' || !Object.values(legalRoutes).includes(setupUrl)) return null;
  return legalRoutes[mode];
}

export function getOperationalWorkspaceRoot(pathname: string): string | null {
  return ['/admin', '/customer', '/broker', '/driver'].find((root) => pathname === root || pathname.startsWith(root + '/')) ?? null;
}
