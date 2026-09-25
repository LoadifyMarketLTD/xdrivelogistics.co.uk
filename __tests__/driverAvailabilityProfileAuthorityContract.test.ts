import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver availability profile server authority', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/availability/page.tsx'), 'utf8');
  const api = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/availability-profile/route.ts'), 'utf8');
  const mobile = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'), 'utf8');

  it('moves availability and destination preference mutations behind authenticated APIs', () => {
    expect(page).not.toContain("supabase.from('drivers').update({ availability_status");
    expect(page).not.toContain(".update({ destination_priority_enabled:");
    expect(page).toContain("fetch('/api/driver/availability-profile'");
    expect(api).toContain('requireActiveWebDriver(request)');
    expect(api).toContain(".eq('user_id', context.userId)");
    expect(api).toContain(".eq('app_access', true)");
  });

  it('clears public availability presence when the driver is no longer available', () => {
    expect(api).toContain("if (data.availability_status !== 'available')");
    expect(api).toContain("from('driver_availability_presence').delete()");
  });
  it('exposes and updates destination matching preferences for native Driver consumers', () => {
    expect(mobile).toContain('destination_priority_enabled,destination_radius_miles');
    expect(mobile).toContain("action === 'update_destination_preferences'");
    expect(mobile).toContain('destinationRadiusMiles');
  });

  it('keeps web and native destination matching radius aligned with the 300-mile matcher range', () => {
    for (const radius of [10, 20, 30, 50, 100, 200, 300]) {
      expect(page).toContain(`<option value="${radius}">${radius}</option>`);
    }
    expect(api).toContain('[10, 20, 30, 50, 100, 200, 300].includes(radius)');
    expect(mobile).toContain('[10, 20, 30, 50, 100, 200, 300].includes(radius)');
  });
});
