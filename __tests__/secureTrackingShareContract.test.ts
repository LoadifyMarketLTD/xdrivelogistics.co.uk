import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const issue = readFileSync(resolve(process.cwd(), 'app/api/tracking/jobs/[jobId]/share/route.ts'), 'utf8');
const sharedRead = readFileSync(resolve(process.cwd(), 'app/api/tracking/share/[token]/route.ts'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'app/track/[token]/page.tsx'), 'utf8');
const panel = readFileSync(resolve(process.cwd(), 'app/components/tracking/JobLiveTrackingPanel.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260826101500_secure_tracking_share_tokens.sql'), 'utf8');

describe('secure live tracking share contract', () => {
  it('issues high-entropy bearer tokens but stores only their sha256 hash', () => {
    expect(issue).toContain("randomBytes(32).toString('base64url')");
    expect(issue).toContain("createHash('sha256').update(rawToken).digest('hex')");
    expect(issue).toContain('token_hash: tokenHash');
    expect(migration).toContain('token_hash text NOT NULL UNIQUE');
    expect(migration).not.toContain('raw_token');
  });

  it('allows link creation only to poster or awarded carrier members while the job is active', () => {
    expect(issue).toContain('posterAccess');
    expect(issue).toContain('carrierAccess');
    expect(issue).toContain("Only the job poster or awarded carrier can share live tracking.");
    expect(issue).toContain("Tracking can only be shared while the job is active.");
  });

  it('makes the shared token table server-only', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.job_tracking_share_tokens FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT ALL ON TABLE public.job_tracking_share_tokens TO service_role');
  });

  it('ends shared location access when execution ends and never returns fleet/company identifiers', () => {
    expect(sharedRead).toContain("if (!ACTIVE.has(phase) || !job.assigned_driver_id)");
    expect(sharedRead).toContain("reason: 'tracking-ended'");
    expect(sharedRead).not.toContain('company_id:');
    expect(sharedRead).not.toContain('awarded_carrier_company_id:');
    expect(sharedRead).not.toContain('display_name');
  });

  it('provides WhatsApp and copy-link actions without WhatsApp Business API dependency', () => {
    expect(panel).toContain('Share Live Tracking via WhatsApp');
    expect(panel).toContain('Copy Tracking Link');
    expect(panel).toContain('https://wa.me/?text=');
    expect(page).toContain('Secure read-only tracking for this delivery only');
  });
});
