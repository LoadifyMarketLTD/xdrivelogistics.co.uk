import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('distance coordinate safety contract', () => {
  for (const route of [
    'app/api/driver/mobile/nearby-jobs/route.ts',
    'app/api/driver/search-loads/route.ts',
  ]) {
    it(route + ' rejects null/blank coordinates before Number coercion', () => {
      const source = readFileSync(new URL('../' + route, import.meta.url), 'utf8');
      expect(source).toContain("if (lat === null || lat === undefined || lng === null || lng === undefined) return null;");
      expect(source).toContain("if (typeof lat === 'string' && lat.trim() === '') return null;");
      expect(source).toContain("if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;");
      expect(source).toContain("if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;");
    });
  }
});
