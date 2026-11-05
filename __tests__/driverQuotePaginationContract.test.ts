import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver personal quote history pagination contract', () => {
  const source = readFileSync(join(process.cwd(), 'app/api/driver/web/bids/route.ts'), 'utf8');
  it('validates a bounded page parameter', () => {
    expect(source).toContain("searchParams.get('page')");
    expect(source).toContain("Number(pageText) > 10000");
    expect(source).toContain("error: 'Invalid page.'");
  });
  it('loads every outgoing quote page in the desktop Driver workspace', () => {
    const page = readFileSync(join(process.cwd(), 'app/driver/quotes/page.tsx'), 'utf8');
    expect(page).toContain('.range(start, start + 149)');
    expect(page).toContain('outgoingRows.push(...rows)');
    expect(page).toContain('if (rows.length < 150) break;');
  });
  it('returns page metadata and one page of personal bids', () => {
    expect(source).toContain('.range(page * pageSize, (page + 1) * pageSize)');
    expect(source).toContain('hasMore: (bids ?? []).length > pageSize');
    expect(source).toContain('bids: (bids ?? []).slice(0, pageSize)');
    expect(source).toContain('.or(identityFilters.join');
  });
});
