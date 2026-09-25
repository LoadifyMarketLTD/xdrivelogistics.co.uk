import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver Future Position temporal contract', () => {
  const api = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/future-position/route.ts'), 'utf8');
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/returns/page.tsx'), 'utf8');

  it('rejects stale future-position timestamps server-side', () => {
    expect(api).toContain('parsed.getTime() <= Date.now()');
    expect(api).toContain('Future-position date/time must be in the future.');
  });

  it('keeps Future Position wired to the authoritative Driver endpoint', () => {
    expect(page).toContain("fetch('/api/driver/future-position'");
    expect(page).toContain("method: 'PUT'");
  });
});
