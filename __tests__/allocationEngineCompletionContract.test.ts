import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read=(relative:string)=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');

describe('canonical Allocation engine completion',()=>{
  const assignments=read('app/admin/fleet/assignments/page.tsx');
  const activeJobs=read('app/admin/fleet/active-jobs/FleetActiveJobsPage.tsx');
  const fleetJobs=read('app/admin/fleet/jobs/page.tsx');
  const assignApi=read('app/api/admin/jobs/[id]/assign-driver/route.ts');
  const directResources=read('app/api/jobs/direct-booking-resources/route.ts');
  const create=read('app/api/jobs/create/route.ts');
  const allocationRpc=read('supabase/migrations/20260927110000_fleet_manager_persisted_role_foundation.sql');
  const doubleBooking=read('supabase/migrations/20260820104000_fleet_resource_double_booking_guard.sql');
  const acceptance=read('supabase/migrations/20260917214605_driver_explicit_acceptance.sql');

  it('keeps final allocation behind the existing atomic RPC and optimistic concurrency',()=>{
    expect(assignApi).toContain("rpc('assign_job_driver_atomic'");
    expect(assignApi).toContain('p_expected_assigned_driver_id');
    expect(allocationRpc).toContain("v_job.assigned_driver_id IS DISTINCT FROM p_expected_assigned_driver_id");
    expect(allocationRpc).toContain("NOT IN ('owner', 'admin', 'fleet_manager', 'dispatcher')");
  });

  it('revalidates canonical driver and vehicle readiness server-side',()=>{
    expect(allocationRpc).toContain('driver_operational_eligibility(p_driver_id)');
    expect(allocationRpc).toContain('v_driver_vehicle_id');
    expect(create).toContain("rpc('driver_operational_eligibility'");
    expect(create).toContain('The selected vehicle is not the canonical eligible vehicle for this driver.');
    expect(directResources).toContain("['owner', 'admin', 'fleet_manager', 'dispatcher']");
  });

  it('uses the same driver-bound vehicle vocabulary in internal Direct Booking UI',()=>{
    expect(create).toContain('canonicalVehicleId');
    expect(assignments).toContain('canonical active vehicle');
    const posting=read('app/components/workspace/LoadPostingForm.tsx');
    expect(posting).toContain('vehicle.assignedDriverId === internalDriverId');
    expect(posting).toContain("setInternalVehicleId('')");
  });

  it('supports explicit pre-execution unallocation and deliberate reallocation without silently preselecting a driver',()=>{
    expect(assignments).toContain('clearAllocation');
    expect(assignments).toContain('expectedDriverId: selectedJob.assigned_driver_id');
    expect(assignments).toContain('Replace driver + vehicle');
    expect(assignments).toContain('current driver is never silently preselected');
    expect(assignments).toContain("selectedCanonicalStage === 'allocated'");
    expect(activeJobs).toContain('Replace allocation');
    expect(fleetJobs).toContain('Reallocate');
  });

  it('preserves active-execution safety and global driver/vehicle double-booking guards',()=>{
    expect(allocationRpc).toContain('Active execution requires an eligible replacement driver and canonical vehicle.');
    expect(doubleBooking).toContain('pg_advisory_xact_lock');
    expect(doubleBooking).toContain('Driver or vehicle is already reserved by job');
    expect(doubleBooking).toContain('trg_guard_job_resource_double_booking');
  });

  it('preserves explicit Driver acceptance after allocation',()=>{
    expect(acceptance).toContain("when 'allocated' then 'accepted'");
    expect(acceptance).toContain("when 'accepted' then 'on_my_way'");
    expect(acceptance).toContain('Driver execution lifecycle with explicit allocated -> accepted -> on_my_way acceptance stage.');
  });
});
