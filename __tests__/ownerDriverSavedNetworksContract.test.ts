import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const directory = fs.readFileSync(path.join(root, 'app/components/workspace/MemberDirectoryPage.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/driver/watchlist/route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261003080500_company_watchlist.sql'), 'utf8');

describe('Owner Driver Saved Networks contract', () => {
  it('exposes Saved Networks only to the Owner Driver workspace', () => {
    expect(directory).toContain("resolveWorkspaceRole(user) === 'owner_driver'");
    expect(directory).toContain('Saved Networks (');
    expect(directory).toContain('ownerDriver ? (');
    expect(directory).not.toContain('Saved Networks is not yet backed by a Driver API');
  });

  it('loads, saves and removes companies through the authenticated Driver API', () => {
    expect(directory).toContain("fetch('/api/driver/watchlist'");
    expect(directory).toContain("currentlySaved ? 'DELETE' : 'POST'");
    expect(directory).toContain("'Content-Type': 'application/json'");
    expect(directory).toContain('Save Network');
    expect(directory).toContain('Remove Saved');
    expect(directory).toContain('savedCompanyIds.has(company.companyId)');
  });

  it('enforces Owner Driver authority server-side instead of trusting the UI', () => {
    expect(route).toContain(".select('id, company_id, driver_type, can_commercial_bid')");
    expect(route).toContain("driver_type ?? '').trim().toLowerCase() !== 'owner_driver'");
    expect(route).toContain('driver.can_commercial_bid !== true');
    expect(route).toContain('Saved Networks is available to Owner Driver accounts only.');
    expect(route).toContain("if (targetCompanyId === ctx.companyId)");
  });

  it('stores saved companies behind service-role-only table access', () => {
    expect(migration).toContain('create table if not exists public.company_watchlist');
    expect(migration).toContain('unique(owner_company_id,target_company_id)');
    expect(migration).toContain('check(owner_company_id <> target_company_id)');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.company_watchlist from anon, authenticated');
    expect(migration).toContain('grant select, insert, delete on table public.company_watchlist to service_role');
  });
});
