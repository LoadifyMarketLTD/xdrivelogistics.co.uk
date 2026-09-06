import fs from 'node:fs';
import path from 'node:path';

describe('driver mobile bid mutation contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/bids/route.ts'),
    'utf8',
  );

  it('keeps all quote mutations behind the native driver gate', () => {
    expect(source).toContain('async function requireMobileDriver');
    expect(source).toContain('return requireDriver(request)');
    expect(source).toContain('export async function PATCH');
    expect(source).toContain('export async function DELETE');
  });

  it('only edits submitted quotes and rechecks that the job is still open', () => {
    expect(source).toContain("String(existing.status).toLowerCase() !== 'submitted'");
    expect(source).toContain("job.status !== 'posted'");
    expect(source).toContain(".update({ amount, bid_price_gbp: amount, message: message || null })");
  });

  it('withdraws by status transition rather than deleting commercial history', () => {
    expect(source).toContain(".update({ status: 'withdrawn' })");
    expect(source).not.toContain(".from('job_bids')\n    .delete()");
  });
});
