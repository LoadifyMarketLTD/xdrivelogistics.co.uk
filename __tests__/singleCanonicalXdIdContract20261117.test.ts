import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  collectionReferenceIdentity,
  verifiedCollectionCommercialActorId,
} from '../lib/jobs/collectionReferenceIdentity';

const source = (path: string) => readFileSync(path, 'utf8');
const create = source('supabase/migrations/20261117092847_unify_owner_driver_public_identity.sql');
const reconcile = source('supabase/migrations/20261117092858_reconcile_verified_owner_driver_legacy_ids.sql');
const handover = source('app/api/driver/mobile/jobs/[id]/handover/route.ts');
const mobile = source('driver-pwa-reserve/src/ReserveApp.tsx');

describe('ONE immutable commercial XDrive ID per responsible participant', () => {
  it('keeps the exact same XD ID for an Owner Driver and personal business workspace', () => {
    expect(verifiedCollectionCommercialActorId('owner_driver', 'XD-001834', 'XD-001834')).toBe('XD-001834');
    expect(verifiedCollectionCommercialActorId('owner_driver', 'xd-001834', 'xd-001834')).toBe('XD-001834');
    expect(collectionReferenceIdentity('db68930a-4488-430e-956b-27eb64f60297', 'XD-001834'))
      .toEqual({ jobReference: 'XDL-DB68930A', carrierCompanyReference: 'XD-001834' });
  });

  it('blocks a duplicated Owner Driver ID rather than picking either one', () => {
    expect(verifiedCollectionCommercialActorId('owner_driver', 'XD-001834', 'XD-001563')).toBeNull();
    expect(verifiedCollectionCommercialActorId('owner_driver', 'XD-001834', '')).toBeNull();
    expect(verifiedCollectionCommercialActorId('owner_driver', '', 'XD-001563')).toBeNull();
  });

  it('uses the employing company ID for every Company Driver; employee login is separately audited', () => {
    expect(verifiedCollectionCommercialActorId('company_driver', 'XD-001834', 'XD-001563')).toBe('XD-001834');
    expect(verifiedCollectionCommercialActorId('company_driver', 'XD-001834', null)).toBe('XD-001834');
    expect(verifiedCollectionCommercialActorId('company_driver', null, 'XD-001563')).toBeNull();
    expect(verifiedCollectionCommercialActorId(null, 'XD-001834', 'XD-001834')).toBeNull();
    expect(verifiedCollectionCommercialActorId('not_checked', 'XD-001834', 'XD-001834')).toBeNull();
  });

  it('permanently stops minting a second ID when creating a personal Owner Driver workspace', () => {
    expect(create).toContain("if new.company_type in ('owner_driver', 'sole_trader') then");
    expect(create).toContain('select p.xd_id into v_user_xd_id');
    expect(create).toContain('new.xd_id := v_user_xd_id;');
    expect(create).toContain('new.xd_id := public.generate_xd_public_id();');
    expect(create).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(create).toContain("An Owner Driver already has a personal XDrive workspace; reuse it.");
    expect(create).toContain('trg_guard_personal_workspace_identity_type');
    expect(create).toContain('Personal workspace identity or owner change needs a verified identity reconciliation.');
  });

  it('restricts historical aliases to server-side lookup and retains issued invoices', () => {
    expect(create).toContain('create table if not exists public.xd_public_id_aliases');
    expect(create).toContain('enable row level security');
    expect(create).toContain('revoke all on public.xd_public_id_aliases from public, anon, authenticated;');
    expect(create).toContain('grant select on public.xd_public_id_aliases to service_role;');
    expect(create).toContain('grant execute on function public.resolve_canonical_xd_public_id(text) to service_role;');
    expect(reconcile).toContain('from public.invoices i');
    expect(reconcile).toContain('from public.jobs j');
    expect(reconcile).not.toContain('update public.invoices');
    expect(reconcile).not.toContain('delete from public.invoices');
    expect(reconcile).not.toContain('update public.jobs');
  });

  it('reconciles only identity-registry-verified Owner Drivers, with rollback-safe immutability restoration', () => {
    expect(reconcile).toContain("registry.identity_mode='owner_driver'");
    expect(reconcile).toContain("registry.status='active'");
    expect(reconcile).toContain('registry.verified_at is not null');
    expect(reconcile).toContain('c.created_by=p.user_id');
    expect(reconcile).toContain("d.driver_type='owner_driver'");
    expect(reconcile).toContain('create temporary table xdrive_verified_owner_id_reconciliation');
    expect(reconcile).toContain('set local lock_timeout');
    expect(reconcile).toContain('alter table public.profiles enable always trigger trg_profiles_xd_id_immutable;');
    expect(reconcile).toContain('alter table public.companies enable always trigger trg_companies_xd_id_immutable;');
    expect(reconcile).toContain('trg_owner_driver_single_public_id');
    expect(reconcile).toContain('commit;');
  });

  it('does not let a client spoof either ID or rewrite the posting customer reference', () => {
    expect(handover).toContain("supabaseAdmin!.from('companies').select('xd_id, company_type').eq('id', companyId).maybeSingle()");
    expect(handover).toContain("supabaseAdmin!.from('profiles').select('xd_id').eq('user_id', userId).maybeSingle()");
    expect(handover).toContain("verifiedCollectionCommercialActorId(driverType, company.xd_id, ownerProfile.data?.xd_id)");
    expect(handover).toContain("job.assigned_company_id !== driver.companyId");
    expect(handover).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(handover).toContain('carrierCompanyReference: references!.identity!.carrierCompanyReference');
    expect(handover).toContain('customerReference: cleanString(job.customer_reference || job.customer_ref, 120)');
    expect(handover).not.toContain('const yourReference = cleanString(body.yourReference');
    expect(handover).not.toContain('const customerReference = cleanString(body.customerReference');
  });

  it('only shows two server-verified read-only fields, not personal internal UUIDs', () => {
    expect(mobile).toContain('label="XDrive Job Reference"');
    expect(mobile).toContain('label="Transport Operator XDrive ID"');
    expect(mobile).toContain('readOnly aria-readonly="true" value={yourReference}');
    expect(mobile).toContain('readOnly aria-readonly="true" value={carrierReference}');
    expect(mobile).not.toContain('label="Owner Driver Personal Profile ID"');
  });
});
