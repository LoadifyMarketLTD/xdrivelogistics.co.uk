import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = fs.readFileSync('driver-pwa-next/src/ReserveApp.tsx', 'utf8');
const server = fs.readFileSync('app/api/driver/web/jobs/[id]/pod-draft/route.ts', 'utf8');

describe('Driver NEXT POD draft API contract', () => {
  it('sends itemCount as a string when saving draft before final POD submit', () => {
    expect(server).toContain("'itemCount'");
    expect(server).toContain("else if (typeof value === 'string')");
    expect(server).toContain("error: 'POD draft contains an invalid field.'");
    expect(app).toContain('const podDraft={recipientName:draft.recipient.trim(),leftAt:draft.leftAt,itemCount:String(draft.items)');
    expect(app).not.toContain('const podDraft={recipientName:draft.recipient.trim(),leftAt:draft.leftAt,itemCount:Number(draft.items)');
  });
  it('keeps the numeric item count for the separate final mobile POD endpoint', () => {
    expect(app).toContain("recipientName:draft.recipient.trim(),leftAt:draft.leftAt,itemCount:Number(draft.items),");
  });
  it('preserves the server-verified signature and previously uploaded attachments', () => {
    expect(app).toContain('verifiedSignature!==signature');
    expect(app).toContain('priorPaths(priorState.draft?.photoUris)');
    expect(app).toContain('priorPaths(priorState.draft?.documentUris)');
    expect(app).toContain('if(!complete){');
  });
});
