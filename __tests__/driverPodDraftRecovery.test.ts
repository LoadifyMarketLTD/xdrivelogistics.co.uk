import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { recoverDeliveredTime } from '../driver-pwa-reserve/src/podDraftRecovery';

const history = [
  {status:'awarded',at:'2026-11-16T11:11:37Z'},
  {status:'on_site_delivery',at:'2026-11-16T13:32:41Z'},
  {status:'delivered',at:'2026-11-16T14:00:15Z'},
];

describe('Driver POD draft recovery and server-authoritative delivery time', () => {
  it('recovers the Delivered status timestamp for a legacy POD draft missing the time', () => {
    expect(recoverDeliveredTime(undefined,'',history,'2026-11-16')).toBe('14:00');
  });
  it('preserves an explicit saved time', () => {
    expect(recoverDeliveredTime('13:59','',history,'2026-11-16')).toBe('13:59');
  });
  it('preserves a legitimate time entered in the current form', () => {
    expect(recoverDeliveredTime('', '14:01',history,'2026-11-16')).toBe('14:01');
  });
  it('does not invent a time when history is absent', () => {
    expect(recoverDeliveredTime('', '', [], '2026-11-16')).toBe('');
  });
  it('does not infer from the scheduled delivery date if the event date differs', () => {
    expect(recoverDeliveredTime('', '',history, '2026-11-20')).toBe('');
  });
  it('ignores non-delivery events and malformed timestamps', () => {
    expect(recoverDeliveredTime('', '', [{status:'loaded',at:'2026-11-16T14:00:00Z'},{status:'delivered',at:'bad'}], '2026-11-16')).toBe('');
  });
  it('rejects malformed time fields rather than silently treating them as valid', () => {
    expect(recoverDeliveredTime('25:00','',history,'2026-11-16')).toBe('14:00');
  });
  it('restores drafts with refreshed authentication and exposes failures', () => {
    const src=readFileSync('driver-pwa-reserve/src/ReserveApp.tsx','utf8');
    expect(src).toContain('let authorised=await renewSession(session)');
    expect(src).toContain('if(res.status===401)');
    expect(src).toContain('await renewSession(authorised,true)');
    expect(src).toContain('Your stored evidence is preserved');
    expect(src).toContain('deliveredTime:recoverDeliveredTime(');
    expect(src).toContain('<Field label="Delivery Time *"><input type="time"');
  });
});
