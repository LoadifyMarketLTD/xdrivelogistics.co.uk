import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('canonical load type posting contract', () => {
  const form = read('app/components/workspace/LoadPostingForm.tsx');
  const create = read('app/api/jobs/create/route.ts');
  const driverSearch = read('app/api/driver/search-loads/route.ts');
  const companyMarket = read('app/api/marketplace/company/route.ts');
  const driverMarket = read('app/api/driver/marketplace/loads/route.ts');
  const migration = read('supabase/migrations/20261009103000_add_canonical_load_types.sql');

  it('persists a canonical load_type with regular and daily-hire scheduling fields', () => {
    expect(migration).toContain('load_type text not null');
    expect(migration).toContain('recurrence_rule jsonb');
    expect(migration).toContain('hire_end_datetime timestamptz');
    expect(migration).toContain("'on_demand','regular_load','daily_hire'");
    expect(create).toContain("loadType: z.enum(['on_demand', 'regular_load', 'daily_hire'])");
    expect(create).toContain('load_type: input.loadType');
    expect(create).toContain("recurrence_rule: input.loadType === 'regular_load'");
    expect(create).toContain("hire_end_datetime: input.loadType === 'daily_hire'");
  });

  it('exposes On Demand, Regular Load and Daily Hire in the shared Post Load form', () => {
    expect(form).toContain("label: 'On Demand'");
    expect(form).toContain("label: 'Regular Load'");
    expect(form).toContain("label: 'Daily Hire'");
    expect(form).toContain('Operating days');
    expect(form).toContain('Hire end time');
    expect(form).toContain('loadType: form.loadType');
    expect(form).toContain("regularSchedule: form.loadType === 'regular_load'");
    expect(form).toContain("hireEndDateTime: form.loadType === 'daily_hire'");
  });

  it('validates scheduling semantics on both client and server', () => {
    expect(form).toContain('Select at least one operating day for a Regular Load.');
    expect(form).toContain('Daily Hire end time must be later than the start time.');
    expect(create).toContain('Regular Load requires at least one operating day.');
    expect(create).toContain('Daily Hire end time must be later than the hire start time.');
  });

  it('makes marketplace APIs prefer the persisted canonical type', () => {
    for (const source of [driverSearch, companyMarket]) {
      expect(source).toContain('load_type: string | null');
      expect(source).toContain("const canonical = String(row.load_type ?? '').toLowerCase()");
      expect(source).toContain("'service_mode', 'load_type'");
    }
    expect(driverMarket).toContain("load_type: marketplaceText(job.load_type) ?? 'on_demand'");
    expect(driverMarket).toContain("loadType: marketplaceText(job.load_type) ?? 'on_demand'");
  });
});
