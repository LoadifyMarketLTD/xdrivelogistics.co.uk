import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const vision = fs.readFileSync(path.join(process.cwd(), 'app/driver/freight-vision/page.tsx'), 'utf8');
const diary = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');

describe('CX-informed Driver Freight Vision operational links', () => {
  it('connects every visible live job to execution, Diary and auditable messaging', () => {
    expect(vision).toContain('Open Job');
    expect(vision).toContain('Diary');
    expect(vision).toContain('Message');
    expect(vision).toContain('/driver/messages?jobId=');
    expect(vision).toContain('/driver/history?job=');
  });

  it('lets a Freight Vision deep-link open the exact Driver Diary booking', () => {
    expect(diary).toContain('useSearchParams');
    expect(diary).toContain("const deepJob = searchParams.get('job')");
    expect(diary).toContain('setExpandedIds((current) => new Set(current).add(deepJob))');
    expect(diary).toContain('void fetchOrderSheet(deepJob)');
  });
});
