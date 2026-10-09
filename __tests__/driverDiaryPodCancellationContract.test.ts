import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const diary = fs.readFileSync(path.join(root, 'app/driver/history/page.tsx'), 'utf8');
const cancellationRoute = fs.readFileSync(path.join(root, 'app/api/driver/jobs/[jobId]/cancellation/route.ts'), 'utf8');
const podHelper = fs.readFileSync(path.join(root, 'lib/jobs/podCompletion.ts'), 'utf8');

describe('Driver Diary POD and cancellation contract', () => {
  it('requires complete POD evidence before invoice creation', () => {
    expect(diary).toContain("import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion'");
    expect(diary).toContain('delivery_signature_data: unknown;');
    expect(diary).toContain('client_signature_name: string | null;');
    expect(diary).toContain('delivery_signature_data, client_signature_name');
    expect(diary).toContain('if (!hasCompletePodEvidence(job))');
    expect(diary).toContain('must include delivery evidence, recipient name and signature');
    expect(diary).toContain('const hasPod = hasCompletePodEvidence(job)');
    expect(podHelper).toContain('record.pod_generated === true');
    expect(podHelper).toContain('evidenceCount > 0');
    expect(podHelper).toContain('hasStoredSignature(record.delivery_signature_data)');
    expect(podHelper).toContain('recipientName.length > 0');
  });

  it('offers cancellation only for allocated or accepted bookings', () => {
    expect(diary).toContain("const canRequestCancellation = ['allocated', 'accepted'].includes(currentStatus)");
    expect(diary).toContain("cancellingJobId === job.id ? 'Sending…' : 'Decline'");
    expect(diary).toContain('requestDiaryCancellation(job)');
  });

  it('routes Diary cancellation through the authenticated atomic cancellation API', () => {
    expect(diary).toContain("/api/driver/jobs/${encodeURIComponent(job.id)}/cancellation");
    expect(diary).toContain('A cancellation reason of at least 5 characters is required.');
    expect(cancellationRoute).toContain("request_awarded_job_cancellation_atomic");
    expect(cancellationRoute).toContain('requireActiveWebDriver(request)');
    expect(cancellationRoute).toContain('p_actor_user_id: driver.userId');
  });
});
