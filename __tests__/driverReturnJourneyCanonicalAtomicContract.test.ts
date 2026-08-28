import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/driver/return-journey/route.ts'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828205000_driver_return_journey_canonical_atomic_replace.sql'),
  'utf8',
);

describe('driver canonical Return Journey atomic contract', () => {
  it('uses the canonical PR #357 columns end-to-end', () => {
    expect(route).toContain('from_postcode');
    expect(route).toContain('to_postcode');
    expect(route).toContain('available_from');
    expect(route).toContain('available_to');
    expect(migration).toContain('from_postcode');
    expect(migration).toContain('to_postcode');
    expect(migration).toContain('available_from');
    expect(migration).toContain('available_to');
    expect(migration).not.toContain('from_location');
    expect(migration).not.toContain('to_location');
    expect(migration).not.toContain('available_date');
  });

  it('replaces or clears through one server-only transactional RPC', () => {
    expect(route).toContain("rpc('replace_driver_return_journey_canonical'");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.replace_driver_return_journey_canonical');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.replace_driver_return_journey_canonical');
    expect(migration).toContain('TO service_role');

    const clearIndex = migration.indexOf('IF v_from_postcode IS NULL THEN');
    const companyRequiredIndex = migration.indexOf('IF p_company_id IS NULL THEN');
    const replacementDeleteIndex = migration.lastIndexOf('DELETE FROM public.return_journeys');
    const replacementInsertIndex = migration.indexOf('INSERT INTO public.return_journeys');

    expect(clearIndex).toBeGreaterThan(-1);
    expect(companyRequiredIndex).toBeGreaterThan(clearIndex);
    expect(replacementDeleteIndex).toBeGreaterThan(companyRequiredIndex);
    expect(replacementInsertIndex).toBeGreaterThan(replacementDeleteIndex);
  });

  it('fails closed on cross-company binding and invalid time windows', () => {
    expect(migration).toContain('d.id = p_driver_id');
    expect(migration).toContain('d.company_id = p_company_id');
    expect(migration).toContain("RAISE EXCEPTION 'Driver company binding is invalid.' USING ERRCODE = '42501'");
    expect(migration).toContain('p_available_to < p_available_from');
    expect(route).toContain("if (error.code === '42501')");
  });

  it('does not perform a delete-first replacement in the HTTP route', () => {
    expect(route).not.toContain('clearCurrentJourney');
    expect(route).not.toContain(".from('return_journeys')\n    .delete()");
    expect(route).not.toContain(".from('return_journeys')\n    .insert(");
  });
});
