import { describe, expect, it } from 'vitest';

import { deriveSecureLoadIntelligence } from '../app/api/super-admin/_lib/secureLoadIntelligence';
import type { DriverOperationalEligibility } from '../app/api/driver/_lib/operationalEligibility';

function eligibility(overrides: Partial<DriverOperationalEligibility> = {}): DriverOperationalEligibility {
  return {
    eligible: true,
    driverId: 'driver-1',
    userId: 'user-1',
    companyId: 'company-1',
    driverType: 'owner_driver',
    canonicalVehicleId: 'vehicle-1',
    blockers: [],
    checks: {
      accountActive: true,
      appAccess: true,
      commercialBidEnabled: true,
      identityVerified: true,
      onboardingApproved: true,
      personalComplianceValid: true,
      companyActive: true,
      membershipActive: true,
      canonicalVehiclePresent: true,
      canonicalVehicleUnambiguous: true,
      vehicleActive: true,
      vehicleComplianceValid: true,
    },
    ...overrides,
  };
}

describe('Secure Load intelligence', () => {
  it('does not invent a POD requirement when pod_required is null', () => {
    const result = deriveSecureLoadIntelligence({
      status: 'delivered',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-1',
      pod_required: null,
    }, eligibility(), false, true, 0);

    expect(result.podRequired).toBe(false);
    expect(result.blockers).not.toContain('required_pod_evidence_missing');
  });

  it('does not treat marketplace bidding permission as an execution credential blocker', () => {
    const result = deriveSecureLoadIntelligence({
      status: 'in_transit',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-1',
    }, eligibility({
      eligible: false,
      blockers: ['commercial_bidding_not_permitted'],
      checks: { ...eligibility().checks, commercialBidEnabled: false },
    }), false, true, 0);

    expect(result.credentialState).toBe('verified');
    expect(result.blockers).not.toContain('commercial_bidding_not_permitted');
  });

  it('fails closed when execution credentials cannot be verified', () => {
    const result = deriveSecureLoadIntelligence({
      status: 'allocated',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-1',
    }, null, true, true, 0);

    expect(result.state).toBe('blocked');
    expect(result.credentialState).toBe('unavailable');
    expect(result.blockers).toContain('credential_verification_unavailable');
  });

  it('blocks a canonical vehicle mismatch on an assigned execution', () => {
    const result = deriveSecureLoadIntelligence({
      status: 'in_transit',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-other',
    }, eligibility(), false, true, 0);

    expect(result.state).toBe('blocked');
    expect(result.blockers).toContain('job_vehicle_differs_from_canonical_driver_vehicle');
  });

  it('uses awaiting_assignment before execution but blocks missing driver during execution', () => {
    const awaiting = deriveSecureLoadIntelligence({ status: 'posted' }, null, false, false, 0);
    const executing = deriveSecureLoadIntelligence({ status: 'in_transit' }, null, false, false, 0);

    expect(awaiting.state).toBe('awaiting_assignment');
    expect(executing.state).toBe('blocked');
    expect(executing.blockers).toContain('execution_driver_not_assigned');
  });

  it('blocks completed jobs only when an explicit POD requirement lacks evidence', () => {
    const missing = deriveSecureLoadIntelligence({
      status: 'completed',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-1',
      pod_required: true,
    }, eligibility(), false, true, 0);
    const present = deriveSecureLoadIntelligence({
      status: 'completed',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-1',
      pod_required: true,
      pod_generated: true,
    }, eligibility(), false, true, 0);

    expect(missing.blockers).toContain('required_pod_evidence_missing');
    expect(present.blockers).not.toContain('required_pod_evidence_missing');
  });
});
