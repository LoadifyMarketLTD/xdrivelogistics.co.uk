export const WORKSPACE_SHELL_DIMENSIONS = {
  desktopSidebar: 230,
  compactSidebar: 56,
  mobileDrawer: 280,
  headerHeight: 50,
} as const;

export const WORKSPACE_SHELL_BREAKPOINTS = {
  compactMaxWidth: 1024,
  mobileMaxWidth: 640,
} as const;

export const WORKSPACE_SHELL_MEASUREMENT_TOLERANCE = {
  desktopSidebarMin: 228,
  desktopSidebarMax: 232,
} as const;

export const workspaceShellPx = (value: number) => `${value}px`;
