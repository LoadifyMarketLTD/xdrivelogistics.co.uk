import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8');

describe('XDrive enquiry governance contract', () => {
  it('uses the shared owner verifier and canonical RPC', () => {
    const route = read('app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts');
    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("rpc('owner_manage_xdrive_enquiry'");
    expect(route).toContain('p_reason: action.reason');
    expect(route).toContain('migrationRequired: true');
  });

  it('does not perform direct quote or job mutations in the API route', () => {
    const route = read('app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts');
    expect(route).not.toContain(".from('quotes')\n      .update(");
    expect(route).not.toContain(".from('jobs').insert(");
  });

  it('keeps conversion, enquiry state and audit in one SQL transaction', () => {
    const migration = read('supabase/migrations/20260831235900_owner_manage_xdrive_enquiry.sql');
    expect(migration).toContain('FOR UPDATE;');
    expect(migration).toContain('INSERT INTO public.jobs (');
    expect(migration).toContain("UPDATE public.quotes\n  SET status = 'converted'");
    expect(migration).toContain('INSERT INTO public.owner_audit_log (');
    expect(migration).toContain('j.creation_idempotency_key = v_quote.id::text');
    expect(migration).toContain("IF lower(coalesce(v_quote.status, '')) <> 'accepted' THEN");
    expect(migration).toContain('TO service_role;');
  });

  it('converges vehicle types across hosted legacy and clean-replay enums', () => {
    const route = read('app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts');
    const compatibility = read('supabase/migrations/20260831235930_owner_manage_xdrive_enquiry_vehicle_type_compat.sql');

    expect(route).toContain('vehicleType = labelToVehicleType(requestedVehicleLabel)');
    expect(route).toContain('p_vehicle_type: vehicleType');
    expect(route).toContain('modern canonical slug');

    expect(compatibility).toContain("e.enumlabel = 'SmallVan'");
    expect(compatibility).toContain("e.enumlabel = 'van_small'");
    expect(compatibility).toContain("v_job_vehicle_type::public.vehicle_type");
    expect(compatibility).toContain("THEN 'LutonVan'");
    expect(compatibility).toContain("THEN 'luton_tail_lift'");
    expect(compatibility).toContain("'resolved_vehicle_type', v_job_vehicle_type");
  });

  it('bounds customer price in both API and database governance', () => {
    const route = read('app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts');
    const compatibility = read('supabase/migrations/20260831235930_owner_manage_xdrive_enquiry_vehicle_type_compat.sql');
    expect(route).toContain('z.number().finite().positive().max(1_000_000)');
    expect(compatibility).toContain('p_amount > 1000000');
  });

  it('requires a reason in the UI', () => {
    const page = read('app/super-admin/xdrive-logistics/page.tsx');
    expect(page).toContain('governanceReason');
    expect(page).toContain('JSON.stringify({ ...payload, reason })');
    expect(page).toContain('durable owner audit log');
    expect(page).toContain('!hasReason || busy !== null');
  });
});
