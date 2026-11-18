import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routePath = path.join(
  process.cwd(),
  'app/api/driver/web/jobs/[id]/confirmation/route.ts',
);
const route = fs.readFileSync(routePath, 'utf8');

describe('driver web recipient confirmation contract', () => {
  it('requires an active web driver and assignment-scoped job', () => {
    expect(route).toContain('requireActiveWebDriver');
    expect(route).toContain('isWebDriverContext');
    expect(route).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  it('requires recipient identity and persisted delivery evidence', () => {
    expect(route).toContain("Recipient name is required.");
    expect(route).toContain("Upload POD evidence first.");
    expect(route).toContain("POD evidence does not belong to this driver assignment.");
    expect(route).toContain(".from('pod-photos')");
  });

  it('persists the recipient attestation before Delivered', () => {
    expect(route).toContain("client_signature_name: recipientName");
    expect(route).toContain("delivery_signature_data: confirmation");
    expect(route).toContain("signature_method: 'typed_name_attestation'");
    expect(route).toContain("source: 'xdrive_driver_web'");
  });
});
