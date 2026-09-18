import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { nextDriverExecutionStatus } from '../lib/jobs/jobLifecyclePresentation';

const mobileLib = readFileSync(new URL('../app/api/driver/mobile/_lib.ts', import.meta.url), 'utf8');
const actionRoute = readFileSync(new URL('../app/api/driver/mobile/jobs/[id]/[action]/route.ts', import.meta.url), 'utf8');
const executionPage = readFileSync(new URL('../app/components/workspace/DriverJobExecutionPage.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260917214605_driver_explicit_acceptance.sql', import.meta.url), 'utf8');

describe('driver explicit acceptance contract', () => {
  it('requires allocated -> accepted -> on_my_way', () => {
    expect(nextDriverExecutionStatus('allocated')).toBe('accepted');
    expect(nextDriverExecutionStatus('accepted')).toBe('on_my_way');
    expect(migration).toContain("when 'allocated' then 'accepted'");
    expect(migration).toContain("when 'accepted' then 'on_my_way'");
  });

  it('keeps accepted distinct through mobile API and UI', () => {
    expect(actionRoute).toContain("accept: 'accepted'");
    expect(mobileLib).not.toContain("if (current === 'allocated') return 'awarded'");
    expect(executionPage).toContain("accepted: 'Accept Job'");
  });
});
