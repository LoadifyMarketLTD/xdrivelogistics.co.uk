import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../app/api/_lib/autoGenerateMarketplaceInvoice.ts', import.meta.url), 'utf8');

describe('auto marketplace invoice POD snapshot contract', () => {
  it('copies immutable delivery evidence metadata onto the generated invoice', () => {
    expect(source).toContain('pod_required, pod_generated, pod_generated_at, delivery_photos, pod_photos, client_signature_name');
    expect(source).toContain("const jobReference = `XDL-${job.id.slice(0, 8).toUpperCase()}`");
    expect(source).toContain('pod_generated: job.pod_generated === true');
    expect(source).toContain('pod_generated_at: cleanText(job.pod_generated_at)');
    expect(source).toContain('pod_photos: podPhotos.length > 0 ? podPhotos : null');
    expect(source).toContain('recipient_name: recipientName');
    expect(source).toContain('delivery_recipient: recipientName');
  });
});
