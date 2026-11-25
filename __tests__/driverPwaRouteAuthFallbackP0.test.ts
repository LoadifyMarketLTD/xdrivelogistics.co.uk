import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type MockReply = { status: number; ok: boolean; json?: () => Promise<unknown> };
const src = readFileSync(resolve(process.cwd(), 'driver-pwa-reserve/src/RouteMap.tsx'), 'utf8');
const begin = src.indexOf('async function roadRoute(');
const end = src.indexOf('const marker=', begin);
if (begin < 0 || end < 0) throw Error('Cannot locate real RouteMap roadRoute implementation');
const snippet = src.slice(begin, end);
const js = ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const route = { geometry: { type: 'LineString', coordinates: [[-0.13, 51.5], [-0.14, 51.51]] }, distanceMiles: 1, durationMinutes: 3 };
const fallback = { routes: [{ geometry: route.geometry, distance: 1609.344, duration: 180 }] };

function runner(replies: Array<MockReply | Error>, local = false) {
  const calls: string[] = [];
  const mockFetch = async (url: string): Promise<MockReply> => {
    calls.push(String(url));
    const reply = replies[calls.length - 1];
    if (!reply) throw Error('Unexpected fallback fetch');
    if (reply instanceof Error) throw reply;
    return reply;
  };
  const factory = new Function('fetch', 'requestPath', 'authHeaders', 'LOCAL', js + '\nreturn roadRoute;');
  const run = factory(mockFetch, (p: string) => '/xdrive-api' + p, () => ({ Authorization: 'Bearer fixture' }), local) as
    (a: { lat: number; lon: number }, b: { lat: number; lon: number }, token: string, signal: AbortSignal) => Promise<typeof route>;
  const execute = () => run({ lat: 51.5, lon: -0.13 }, { lat: 51.51, lon: -0.14 }, 'fixture', new AbortController().signal);
  return { execute, calls };
}

describe('P0 XDrive road routing authorization and availability resilience', () => {
  for (const code of [401, 403]) {
    it(`does not bypass authenticated XDrive route denial ${code} through public OSRM`, async () => {
      const test = runner([{ status: code, ok: false }]);
      await expect(test.execute()).rejects.toThrow('Driver route access denied');
      expect(test.calls).toHaveLength(1);
      expect(test.calls[0]).toContain('/driver/web/public-route');
    });
  }
  it('uses the authenticated XDrive backend result without public fallback', async () => {
    const test = runner([{ status: 200, ok: true, json: async () => route }]);
    expect(await test.execute()).toEqual(route);
    expect(test.calls).toHaveLength(1);
  });
  it('preserves routing fallback when the authorized proxy returns a service outage', async () => {
    const test = runner([{ status: 503, ok: false }, { status: 200, ok: true, json: async () => fallback }]);
    expect((await test.execute()).distanceMiles).toBeCloseTo(1);
    expect(test.calls).toHaveLength(2);
    expect(test.calls[1]).toContain('router.project-osrm.org');
  });
  it('preserves isolated local preview road fallback', async () => {
    const test = runner([{ status: 401, ok: false }, { status: 200, ok: true, json: async () => fallback }], true);
    expect((await test.execute()).distanceMiles).toBeCloseTo(1);
    expect(test.calls).toHaveLength(2);
  });
});