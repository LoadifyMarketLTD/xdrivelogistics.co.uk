/** Detect an installed XDrive PWA or a real mobile browser without relying on CSS width alone. */
export function isInstalledXDrivePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

export function isMobileDriverBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return isInstalledXDrivePwa() || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent) || window.matchMedia('(max-width: 767px)').matches;
}
