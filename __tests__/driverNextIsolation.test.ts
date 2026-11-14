import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const at = (path: string) => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(at('driver-pwa-next/public/manifest.webmanifest'));
const entry = at('driver-pwa-next/src/main.tsx');
const next = at('driver-pwa-next/src/ReserveApp.tsx');
const config = at('driver-pwa-next/vite.config.ts');

describe('Driver NEXT remains an independent installable PWA', () => {
  it('has an isolated manifest identity and standalone route', () => {
    expect(manifest.id).toBe('/driver/reserve-next/');
    expect(manifest.start_url).toBe('/driver/reserve-next/index.html');
    expect(manifest.scope).toBe('/driver/reserve-next/');
    expect(manifest.name).toContain('NEXT');
    expect(at('driver-pwa-next/public/sw.js')).toContain("'/driver/reserve-next/'");
    expect(entry).toContain("register('/driver/reserve-next/sw.js')");
  });
  it('does not reuse the Reserve session or evidence store', () => {
    expect(next).toContain("xdrive-driver-next-live-session-v1");
    expect(next).not.toContain("xdrive-driver-reserve-live-session-v1");
    expect(at('driver-pwa-next/src/PodCapture.tsx')).toContain('xdrive-next-local-pod-v2');
    expect(at('driver-pwa-next/src/DriverSettings.tsx')).toContain('xdrive-next-driver-preferences-v1');
  });
  it('connects local production preview to real XDrive driver API only', () => {
    expect(config).toContain("base: '/driver/reserve-next/'");
    expect(config).toContain("preview: { proxy: { '/api/driver':");
    expect(config).toContain("https://www.xdrivelogistics.co.uk");
    expect(config).not.toContain("app.xdrivelogistics.co.uk");
  });
  it('keeps Vite-specific types out of the platform Next.js typecheck', () => {
    const tsconfig=JSON.parse(at('tsconfig.json'));
    expect(tsconfig.exclude).toContain('driver-pwa-reserve/**');
    expect(tsconfig.exclude).toContain('driver-pwa-next/**');
  });
  it('provides one separately built entrypoint', () => {
    const html=at('public/driver/reserve-next/index.html');
    expect(html).toContain('/driver/reserve-next/assets/');
    expect(html).toContain('/driver/reserve-next/manifest.webmanifest');
    expect(html).not.toContain('/driver/reserve-pwa/');
  });
});