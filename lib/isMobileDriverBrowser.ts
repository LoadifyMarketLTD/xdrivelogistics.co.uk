/** Android/iOS browsers may report a desktop-width layout viewport. */
export function isMobileDriverBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}
