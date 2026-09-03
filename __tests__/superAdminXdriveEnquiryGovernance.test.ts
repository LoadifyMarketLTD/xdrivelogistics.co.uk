import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
const GOVERNANCE = 'supabase/migrations/20260831235900_owner_manage_xdrive_enquiry.sql';
const TAXONOMY = 'supabase/migrations/20260831235930_owner_manage_xdrive_enquiry_vehicle_type_compat.sql';
const ROUTE = 'app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts';
const PAGE = 'app/super-admin/xdrive-logistics/page.tsx';

const canonicalVehicles = [
  'bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'swb_van', 'mwb_van', 'lwb_van', 'xlwb_van',
  'luton', 'luton_tail_lift', 'curtainside_van', 'truck_3_5t', 'truck_5t', 'truck_7_5t', 'truck_12t',
  'truck_18t', 'truck_26t', 'artic', 'artic_44t_curtainsider', 'artic_44t_box_trailer', 'artic_44t_flatbed',
  'artic_44t_refrigerated', 'artic_44t_double_deck', 'hiab', 'moffett', 'adr_vehicle',
  'refrigerated_vehicle', 'temperature_controlled_vehicle',
];

describe('XDrive public enquiry governance', () => {
  it('keeps commercial mutations atomic, serialized, optimistic and audited', () => {
    const migration = readRepoFile(GOVERNANCE);
    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('p_expected_updated_at');
    expect(migration).toContain('creation_idempotency_key = v_quote.id::text');
    expect(migration).toContain("ILIKE '%SOURCE: app.xdrivelogistics.co.uk%'");
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
  });

  it('removes split-brain app writes and requires a reason for every mutation', () => {
    const route = readRepoFile(ROUTE);
    const patch = route.slice(route.indexOf('export async function PATCH'));
    expect(route).toContain("z.string().trim().min(3).max(5000)");
    expect(patch).toContain("supabaseAdmin.rpc('owner_manage_xdrive_enquiry'");
    expect(patch).toContain('p_expected_updated_at: enquiry.updated_at');
    expect(patch).not.toContain('.update(');
    expect(patch).not.toContain('.insert(');
    expect(patch).not.toContain('customer_reference');
    expect(patch).not.toContain('booking_reference');
  });

  it('aligns the DB enum to the complete canonical XDrive vehicle taxonomy', () => {
    const migration = readRepoFile(TAXONOMY);
    for (const vehicle of canonicalVehicles) expect(migration).toContain(`'${vehicle}'`);
    expect(migration).toContain("ALTER TYPE public.vehicle_type ADD VALUE 'truck_18t'");
    expect(migration).toContain("ALTER TYPE public.vehicle_type ADD VALUE 'truck_7_5t'");
    expect(migration).toContain("ALTER TYPE public.vehicle_type ADD VALUE 'van_small'");
    expect(migration).toContain("ALTER TYPE public.vehicle_type ADD VALUE 'van_large'");
  });

  it('fails closed instead of downgrading unsupported transport types', () => {
    const route = readRepoFile(ROUTE);
    expect(route).toContain("'truck_18t'");
    expect(route).toContain("'truck_26t'");
    expect(route).toContain("'artic_44t_curtainsider'");
    expect(route).toContain("'temperature_controlled_vehicle'");
    expect(route).toContain('No fallback vehicle will be used.');
    expect(route).not.toContain('labelToVehicleType');
    expect(route).not.toContain("?? 'van_large'");
  });

  it('requires the Platform Owner to enter a durable governance reason in the UI', () => {
    const page = readRepoFile(PAGE);
    expect(page).toContain('governanceReason');
    expect(page).toContain('reason');
    expect(page).toContain('durable owner audit log');
  });
});
