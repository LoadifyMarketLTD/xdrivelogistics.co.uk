import type { WorkspaceRole } from '../../../lib/workspaceRole';

export type Original3118NavEntry = { label: string; href: string };

/** Match the deepest authenticated commercial route, never a broad dashboard prefix. */
export function activeOriginal3118RouteIndex(
  navigation: readonly Original3118NavEntry[],
  pathname: string,
  homeHref: string,
): number {
  const current = pathname.split('?')[0].split('#')[0];
  const exact = navigation.findIndex(item => item.href.split('?')[0] === current);
  if (exact >= 0) return exact;
  return navigation.map((item, index) => ({ index, href: item.href.split('?')[0] }))
    .filter(item => item.href !== homeHref && current.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.index ?? -1;
}

export function original3118AccountRoute(role: WorkspaceRole): string {
  if (role === 'broker') return '/broker/account';
  if (role === 'driver' || role === 'owner_driver') return '/driver/settings';
  return '/admin/settings';
}

/** Preserve role capability checks separately from visual presentation. */
export function appendAuthorised3118Routes(
  visible: readonly Original3118NavEntry[],
  accountHref: string,
  notificationHref: string,
  allowed: (href: string) => boolean,
): Original3118NavEntry[] {
  const result = [...visible];
  const seen = new Set(result.map(item => item.href));
  for (const item of [{ label: 'Settings', href: accountHref }, { label: 'Notifications', href: notificationHref }]) {
    if (seen.has(item.href) || !allowed(item.href)) continue;
    seen.add(item.href);
    result.push(item);
  }
  return result;
}
