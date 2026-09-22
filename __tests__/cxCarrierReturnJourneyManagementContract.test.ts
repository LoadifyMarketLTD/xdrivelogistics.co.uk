import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-informed carrier Return Journey management contract', () => {
  const page = read('app/admin/fleet/returns/page.tsx');
  const route = read('app/api/admin/return-journeys/route.ts');
  const canonicalRpc = read('supabase/migrations/20260830004421_port_driver_return_journey_canonical_atomic_replace.sql');

  it('lets authorised company operators publish, edit and close driver return capacity', () => {
    expect(page).toContain('Publish Return Journey');
    expect(page).toContain('Publish / Update');
    expect(page).toContain('Close Return');
    expect(page).toContain("['owner', 'admin', 'dispatcher']");
    expect(page).toContain("fetch('/api/admin/return-journeys'");
  });

  it('requires company-admin context and a same-company active driver', () => {
    expect(route).toContain('requireCompanyAdmin(request, parsed.data.companyId)');
    expect(route).toContain("eq('company_id', context.companyId)");
    expect(route).toContain("Return journeys can only be published for an active driver.");
  });

  it('reuses the canonical atomic replacement RPC instead of delete-first UI writes', () => {
    expect(route).toContain(".rpc('replace_driver_return_journey_canonical'");
    expect(route).not.toContain(".from('return_journeys').delete()");
    expect(route).not.toContain(".from('return_journeys').insert(");
    expect(canonicalRpc).toContain('DELETE FROM public.return_journeys');
    expect(canonicalRpc).toContain('INSERT INTO public.return_journeys');
  });

  it('keeps the driver-to-company binding enforced by both API and PostgreSQL', () => {
    expect(route).toContain('p_driver_id: parsed.data.driverId');
    expect(route).toContain('p_company_id: context.companyId');
    expect(canonicalRpc).toContain('d.id = p_driver_id');
    expect(canonicalRpc).toContain('d.company_id = p_company_id');
  });
});
