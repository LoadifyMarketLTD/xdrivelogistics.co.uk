import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830174500_vehicle_driver_company_integrity.sql'),
  'utf8',
);
const runtimeValidation = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830174600_verify_vehicle_driver_company_integrity_runtime.sql'),
  'utf8',
);

describe('vehicle driver company integrity migration contract', () => {
  it('retires only an unreferenced orphan duplicate instead of deleting vehicle history', () => {
    expect(migration).toContain('orphan_company.id IS NULL');
    expect(migration).toContain('canonical.assigned_driver_id = d.id');
    expect(migration).toContain('canonical.company_id = d.company_id');
    expect(migration).toContain("canonical.status::text = 'active'");
    expect(migration).toContain("status = 'inactive'::public.status_enum");
    expect(migration).toContain('assigned_driver_id = NULL');
    expect(migration).toContain('is_available = false');
    expect(migration).not.toContain('DELETE FROM public.vehicles');
  });

  it('refuses to reconcile a vehicle with operational or compliance references', () => {
    for (const reference of [
      'public.vehicle_documents',
      'public.driver_locations',
      'public.jobs',
      'public.job_bids',
      'public.telematics_driver_bindings',
      'public.vehicle_tracking_history',
    ]) {
      expect(migration).toContain(reference);
    }
  });

  it('adds a real company foreign key and preserves company deletion safety', () => {
    expect(migration).toContain('vehicles_company_id_fkey');
    expect(migration).toContain('REFERENCES public.companies(id)');
    expect(migration).toContain('ON DELETE RESTRICT');
    expect(migration).toContain('VALIDATE CONSTRAINT vehicles_company_id_fkey');
  });

  it('enforces one canonical active assigned vehicle per driver', () => {
    expect(migration).toContain('vehicles_one_active_assignment_per_driver_uidx');
    expect(migration).toContain('ON public.vehicles (assigned_driver_id)');
    expect(migration).toContain("status = 'active'::public.status_enum");
  });

  it('rejects cross-company driver assignment at the database boundary', () => {
    expect(migration).toContain('guard_vehicle_assignment_company_integrity');
    expect(migration).toContain('NEW.company_id IS DISTINCT FROM v_driver_company_id');
    expect(migration).toContain("ERRCODE = '23514'");
    expect(migration).toContain('trg_vehicles_assignment_company_integrity');
  });

  it('verifies all three production invariants before commit', () => {
    expect(migration).toContain('v_orphan_companies');
    expect(migration).toContain('v_cross_company_assignments');
    expect(migration).toContain('v_ambiguous_active_assignments');
    expect(migration).toContain('Vehicle integrity verification failed');
  });

  it('contains no production-generated UUID fixture', () => {
    expect(migration).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('proves the live DB rejects cross-company, duplicate-active and orphan-company writes', () => {
    expect(runtimeValidation).toContain('Cross-company vehicle assignment was unexpectedly accepted.');
    expect(runtimeValidation).toContain('WHEN check_violation');
    expect(runtimeValidation).toContain('Second ACTIVE vehicle assignment was unexpectedly accepted.');
    expect(runtimeValidation).toContain('WHEN unique_violation');
    expect(runtimeValidation).toContain('Orphan vehicle company reference was unexpectedly accepted.');
    expect(runtimeValidation).toContain('WHEN foreign_key_violation');
  });

  it('keeps the transactional runtime proof non-destructive and replay-safe', () => {
    expect(runtimeValidation).toContain('IF v_driver_id IS NULL');
    expect(runtimeValidation).toContain('RETURN;');
    expect(runtimeValidation).toContain('Active vehicle changed during runtime verification.');
    expect(runtimeValidation).toContain('Retired vehicle changed during runtime verification.');
    expect(runtimeValidation).not.toContain('DELETE FROM public.vehicles');
  });
});
