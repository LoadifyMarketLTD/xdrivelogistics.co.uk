import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Driver Return Journey atomic replacement', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/return-journey/route.ts'),
    'utf8',
  );
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830004421_port_driver_return_journey_canonical_atomic_replace.sql'),
    'utf8',
  );

  it('binds the API to the canonical authenticated driver context', () => {
    expect(route).toContain('requireDriver(request)');
    expect(route).toContain('isDriverContext(context)');
    expect(route).not.toContain('getBearerToken');
  });

  it('never performs delete-first replacement in the API process', () => {
    expect(route).toContain(".rpc('replace_driver_return_journey_canonical'");
    expect(route).not.toContain(".from('return_journeys')\n    .delete()");
    expect(route).not.toContain(".from('return_journeys')\n    .insert(");
  });

  it('passes the authenticated driver/company binding and canonical journey fields to the RPC', () => {
    expect(route).toContain('p_driver_id: resolved.driverId');
    expect(route).toContain('p_company_id: resolved.companyId');
    expect(route).toContain('p_from_postcode: fromPostcode');
    expect(route).toContain('p_to_postcode: toPostcode');
    expect(route).toContain('p_available_from: parsed.data.available_from');
    expect(route).toContain('p_available_to: parsed.data.available_to');
  });

  it('keeps replacement transactional and validates driver-to-company ownership in PostgreSQL', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.replace_driver_return_journey_canonical');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('d.id = p_driver_id');
    expect(migration).toContain('d.company_id = p_company_id');
    expect(migration).toContain('DELETE FROM public.return_journeys');
    expect(migration).toContain('INSERT INTO public.return_journeys');
  });

  it('keeps the RPC server-only and supports a clear without fabricating a company binding', () => {
    expect(migration).toContain('IF v_from_postcode IS NULL THEN');
    expect(migration).toContain('RETURN NULL;');
    expect(migration).toContain('FROM authenticated;');
    expect(migration).toContain('TO service_role;');
  });
});
