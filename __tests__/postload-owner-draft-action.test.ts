import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const form = readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const api = readFileSync(path.join(root, 'app/api/jobs/create/route.ts'), 'utf8');

describe('Owner Driver Post Load draft action', () => {
  it('exposes Save Draft and keeps publish buttons separate', () => {
    expect(form).toMatch(/onClick=\{\(\) => void save\(false\)\}>Save Draft/);
    expect(form).toMatch(/onClick=\{\(\) => void save\(true\)\}/);
    expect(form).toMatch(/onClick=\{\(\) => void save\(true, true\)\}/);
  });
  it('uses existing authenticated idempotent creation', () => {
    expect(form).toContain("fetch('/api/jobs/create'");
    expect(form).toMatch(/\bidempotencyKey: idempotencyKeyRef\.current/);
    expect(form).toMatch(/\bpublish,\s*proximityAlertsEnabled:/);
  });
  it('draft remains private, not posted to marketplace', () => {
    expect(api).toMatch(/input\.publish \? 'posted' : 'draft'/);
    expect(api).toMatch(/requestedStatus === 'draft' \? 'private' : requestedVisibility/);
    expect(api).toMatch(/exchange_posted_at: deferPublication \? null : \(wantsExchangePublication \? now : null\)/);
    expect(form).toContain('Draft load');
  });
});
