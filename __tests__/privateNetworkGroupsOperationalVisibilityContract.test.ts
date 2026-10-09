import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Private Groups operational visibility completion', () => {
  const migration = read('supabase/migrations/20261009160000_private_network_groups.sql');
  const groupsApi = read('app/api/network/groups/route.ts');
  const membersApi = read('app/api/network/groups/[id]/members/route.ts');
  const directory = read('app/components/workspace/MemberDirectoryPage.tsx');
  const hook = read('app/components/workspace/usePrivateNetworkGroups.ts');
  const posting = read('app/components/workspace/LoadPostingForm.tsx');
  const create = read('app/api/jobs/create/route.ts');
  const marketplace = read('app/api/marketplace/company/route.ts');
  const driverSearch = read('app/api/driver/search-loads/route.ts');
  const nearbyApi = read('app/api/availability/nearby/route.ts');
  const adminAvailability = read('app/admin/live-availability/page.tsx');
  const driverAvailability = read('app/driver/availability/live/page.tsx');
  const driverNearby = read('app/driver/nearby/page.tsx');

  it('adds Private Groups without replacing the existing Saved Network bookmark feature', () => {
    expect(migration).toContain('create table if not exists public.network_groups');
    expect(migration).toContain('create table if not exists public.network_group_members');
    expect(migration).toContain('visibility_group_id uuid');
    expect(migration).toContain("'private_group'");
    expect(directory).toContain('Private Groups');
    expect(directory).toContain('Save Network');
    expect(directory).toContain('Create Group');
    expect(directory).toContain('Rename');
    expect(directory).toContain('Delete Group');
  });

  it('keeps Private Group mutation behind active company membership and authorised company roles', () => {
    expect(groupsApi).toContain("const EDIT_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager'])");
    expect(groupsApi).toContain(".from('company_memberships')");
    expect(groupsApi).toContain(".eq('status', 'active')");
    expect(membersApi).toContain('This role cannot manage Private Group members.');
    expect(membersApi).toContain('A company cannot add itself to its own Private Group.');
    expect(hook).toContain('/api/network/groups?companyId=');
  });

  it('publishes loads either to the whole Exchange or a validated non-empty Private Group', () => {
    expect(posting).toContain('Marketplace audience');
    expect(posting).toContain('Private Group ·');
    expect(posting).toContain("visibility: publish && !directCarrierId && directTargetMode === 'marketplace' && visibilityGroupId ? 'private_group'");
    expect(create).toContain("input.visibility === 'private_group'");
    expect(create).toContain(".eq('owner_company_id', input.companyId)");
    expect(create).toContain('Add at least one company to the Private Group before publishing a load to it.');
    expect(create).toContain('visibility_group_id: privateGroupTarget?.id ?? null');
  });

  it('restricts Private Group marketplace discovery and quoting to member companies', () => {
    expect(marketplace).toContain(".from('network_group_members')");
    expect(marketplace).toContain('exchange_visibility.eq.private_group');
    expect(marketplace).toContain('privateGroupVisible');
    expect(driverSearch).toContain(".from('network_group_members')");
    expect(driverSearch).toContain('exchange_visibility.eq.private_group');
  });

  it('scopes Nearby availability to a Private Group without exposing exact Exchange coordinates', () => {
    expect(nearbyApi).toContain("request.nextUrl.searchParams.get('groupId')");
    expect(nearbyApi).toContain('allow_availability_visibility');
    expect(nearbyApi).toContain('privateGroupCompanyIds');
    expect(nearbyApi).toContain('exchange_lat');
    expect(nearbyApi).toContain('exchange_lng');
    for (const source of [adminAvailability, driverAvailability, driverNearby]) {
      expect(source).toContain('Private Group');
      expect(source).toContain('groupId');
    }
  });
});
