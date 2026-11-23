import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Driver PWA official member identity', () => {
  const resources = read('app/api/driver/web/resources/route.ts');
  const profile = read('driver-pwa-reserve/src/OriginalMorePwa.tsx');

  it('fetches the account commercial XDrive identity from its authenticated profile', () => {
    expect(resources).toContain(".from('profiles')");
    expect(resources).toContain(".select('xd_id')");
    expect(resources).toContain(".eq('user_id', context.userId)");
    expect(resources).toContain('member_id: memberIdentityResult.error ? null : memberIdentityResult.data?.xd_id ?? null');
  });

  it('never labels the private driver UUID as a public Driver ID', () => {
    expect(profile).toContain('<Row label="XDrive Member ID" value={profile.member_id}/>');
    expect(profile).not.toContain('label="Driver ID"');
    expect(profile).not.toContain('value={profile.driver_id}');
  });

  it('does not fabricate or derive a commercial member ID from an internal UUID', () => {
    expect(resources).not.toContain('member_id: context.driverId');
    expect(profile).not.toContain('profile.driver_id.slice');
  });
});
