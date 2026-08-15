import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/api/workspace/jobs/[jobId]/sheet/route.ts'),
  'utf8',
);

describe('workspace job sheet invoice projection', () => {
  it('does not let service-role enrichment bypass customer invoice readiness', () => {
    expect(route).toContain("!['pending', 'draft', 'cancelled'].includes(status)");
    expect(route).toContain('amount > 0');
    expect(route).toContain('netAmount > 0');
    expect(route).toContain('clientName.length > 0');
    expect(route).toContain("const paid = status === 'paid' || paymentStatus === 'paid';");
    expect(route).toContain("const sentWithAuditTrail = deliveryState === 'sent'");
    expect(route).toContain('deliveryProvider.length > 0');
    expect(route).toContain('deliveryMessageId.length > 0');
    expect(route).toContain('deliveryRecipientEmail.length > 0');
    expect(route).toContain('&& (paid || sentWithAuditTrail)');
  });

  it('keeps awarded-carrier invoice visibility explicitly party-scoped', () => {
    expect(route).toContain('Awarded carriers must have an explicit invoice party');
    expect(route).toContain('ids.includes(viewerCompanyId)');
    expect(route).toContain('Do not invent a customer delivery-state rule for supplier-side invoice records');
  });
});
