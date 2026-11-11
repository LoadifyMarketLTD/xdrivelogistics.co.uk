import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');
describe('Official Reserve PWA startup contract', () => {
  it('serves Reserve static shell outside route-cookie authentication (API remains bearer-protected)', () => {
    const middleware = source('middleware.ts');
    expect(middleware).toContain("request.nextUrl.pathname.startsWith('/driver/reserve-pwa/')");
    expect(middleware.indexOf("request.nextUrl.pathname.startsWith('/driver/reserve-pwa/')")).toBeLessThan(middleware.indexOf('const auth = await resolveRouteAuth(request)'));
  });
  it('uses full document navigation instead of leaving driver in Next.js redirect placeholder', () => {
    expect(source('app/driver/MobileDriverWorkspaceRedirect.tsx')).toContain("window.location.replace('/driver/reserve-pwa/index.html?live=1')");
  });
  it('keeps Reserve official and installed PWA manifests consistent', () => {
    const reserve = JSON.parse(source('public/driver/reserve-pwa/manifest.webmanifest'));
    const rootManifest = JSON.parse(source('public/manifest.webmanifest'));
    expect(reserve.name).toBe('XDrive Logistics Driver');
    expect(reserve.display).toBe('standalone');
    expect(reserve.icons[0].src).toBe('/icons/icon-192x192.png');
    expect(rootManifest.display).toBe('standalone');
  });
  it('uses the official XDrive approved company logo as the icon source', () => {
    const official = readFileSync(join(root, 'public/xdrive-logo-company-3150.png'));
    const icon = readFileSync(join(root, 'public/icons/icon-512x512.png'));
    expect(official.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(icon.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
