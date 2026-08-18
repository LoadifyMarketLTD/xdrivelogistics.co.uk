import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'app/driver/availability/page.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'app/api/driver/availability-slots/route.ts'), 'utf8');

describe('driver weekly availability truth contract', () => {
  it('does not turn missing persisted slots into optimistic availability', () => {
    expect(page).toContain('const current = weeklySlots[key] ?? false');
    expect(page).toContain('const isAvailable = weeklySlots[key] === true');
    expect(page).toContain('No saved pattern');
    expect(page).not.toContain('Default available');
  });

  it('keeps saved slot mutation server-backed', () => {
    expect(page).toContain("fetch('/api/driver/availability-slots'");
    expect(api).toContain(".from('driver_availability_slots')");
    expect(api).toContain('.upsert(');
  });
});
