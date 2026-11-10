import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInstalledXDrivePwa, isMobileDriverBrowser } from '../lib/isMobileDriverBrowser';

afterEach(() => vi.unstubAllGlobals());

function browser(userAgent: string, standalone: boolean, widthMobile = false, iosStandalone = false) {
  vi.stubGlobal('window', {
    navigator: { userAgent, standalone: iosStandalone },
    matchMedia: (query: string) => ({ matches: query.includes('display-mode') ? standalone : widthMobile }),
  });
}

describe('XDrive driver installed PWA detection', () => {
  it('recognises installed PWA even when browser reports desktop dimensions', () => {
    browser('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', true);
    expect(isInstalledXDrivePwa()).toBe(true);
    expect(isMobileDriverBrowser()).toBe(true);
  });
  it('keeps ordinary desktop browser in desktop workspace', () => {
    browser('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false);
    expect(isInstalledXDrivePwa()).toBe(false);
    expect(isMobileDriverBrowser()).toBe(false);
  });
  it('recognises Android phone requesting desktop layout', () => {
    browser('Mozilla/5.0 (Linux; Android 16; Pixel 10)', false);
    expect(isMobileDriverBrowser()).toBe(true);
  });
  it('recognises installed iOS home-screen app', () => {
    browser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', false, false, true);
    expect(isInstalledXDrivePwa()).toBe(true);
  });
});
