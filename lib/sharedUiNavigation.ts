export type AuthorizedNavigationTarget = {
  id: string;
  label: string;
  href: string;
};

export const filterAuthorizedNavigation = (
  navigation: readonly AuthorizedNavigationTarget[],
  query: string,
  limit = 8,
): AuthorizedNavigationTarget[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return navigation
    .filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.href.toLowerCase().includes(normalized),
    )
    .slice(0, Math.max(0, limit));
};

export const shouldShowCompanySwitcher = (membershipCount: number): boolean =>
  membershipCount > 1;

export const shouldShowWorkspaceSwitcher = (
  enabledWorkspaceCount: number,
): boolean => enabledWorkspaceCount > 1;
