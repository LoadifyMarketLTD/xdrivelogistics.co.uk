import { describe, it, expect } from 'vitest';
import { resolveWorkspacePermission } from '../lib/workspacePermissionResolver';

describe('resolveWorkspacePermission', () => {
  it('fails closed for null/empty/unknown company types', () => {
    for (const companyType of [null, '', 'unknown'] as const) {
      const result = resolveWorkspacePermission({
        companyType,
        membershipStatus: 'active',
        membershipRole: 'owner',
        pathname: '/admin/jobs',
      });
      expect(result).toEqual({ allowed: false, reason: 'unsupported_company_type' });
    }
  });

  it('denies when workspace is disabled', () => {
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['broker'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
    });
    expect(result).toEqual({ allowed: false, reason: 'workspace_not_enabled' });
  });

  it('denies explicitly requested workspace when not permitted', () => {
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      requestedWorkspace: 'broker',
      pathname: '/admin/jobs',
    });
    expect(result).toEqual({ allowed: false, reason: 'requested_workspace_not_permitted' });
  });

  it('denies unknown protected routes', () => {
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/invented-route',
    });
    expect(result).toEqual({ allowed: false, reason: 'unmapped_route' });
  });

  it('denies cross-workspace paths and URL manipulation', () => {
    const crossWorkspace = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/customer/loads',
    });
    expect(crossWorkspace).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });

    const manipulated = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/%2e%2e/customer/loads',
    });
    expect(manipulated).toEqual({ allowed: false, reason: 'malformed_route' });
  });

  it('keeps full membership role identity (finance/compliance/driver)', () => {
    const finance = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'finance',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/invoices',
    });
    expect(finance).toEqual({
      allowed: true,
      membershipRole: 'finance',
      activeWorkspace: 'carrier_fleet',
    });

    const compliance = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'compliance',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/documents',
    });
    expect(compliance).toEqual({
      allowed: true,
      membershipRole: 'compliance',
      activeWorkspace: 'carrier_fleet',
    });

    const driver = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
    });
    expect(driver).toEqual({
      allowed: true,
      membershipRole: 'driver',
      activeWorkspace: 'carrier_fleet',
    });
  });
});

describe('resolveWorkspacePermission — workspace ∩ membership capability intersection', () => {
  it('denies when role has capability but workspace does not expose it', () => {
    // owner has 'company.manage' but carrier_fleet workspace does not expose it
    // (carrier_fleet exposes loads.view.marketplace, quotes.submit, jobs.*, drivers.manage, etc.)
    // Use requiredCapability to force the check
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
      requiredCapability: 'loads.create', // carrier_fleet does NOT expose loads.create
    });
    expect(result).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });

  it('denies when workspace exposes capability but role does not have it', () => {
    // carrier_fleet exposes 'jobs.allocate' but 'viewer' role does not have it
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'viewer',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
      requiredCapability: 'jobs.allocate',
    });
    expect(result).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });

  it('allows when both workspace and role have the capability', () => {
    // carrier_fleet exposes 'jobs.dispatch' and dispatcher role has it
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'dispatcher',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
      requiredCapability: 'jobs.dispatch',
    });
    expect(result).toEqual({
      allowed: true,
      membershipRole: 'dispatcher',
      activeWorkspace: 'carrier_fleet',
    });
  });

  it('denies shipper role capability on a carrier_fleet workspace route (anyOf intersection)', () => {
    // /admin/operations-centre requires anyOf: ['jobs.dispatch']
    // carrier_fleet exposes 'jobs.dispatch', but 'viewer' does not have it
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'viewer',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/operations-centre',
    });
    expect(result).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });
});

describe('resolveWorkspacePermission — foundation security contract matrix', () => {
  it('allows shipper and broker owners on authorized routes/capabilities', () => {
    const shipper = resolveWorkspacePermission({
      companyType: 'shipper',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['shipper'],
      activeWorkspace: 'shipper',
      pathname: '/customer/loads',
    });
    expect(shipper).toEqual({
      allowed: true,
      membershipRole: 'owner',
      activeWorkspace: 'shipper',
    });

    const broker = resolveWorkspacePermission({
      companyType: 'broker',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['broker'],
      activeWorkspace: 'broker',
      pathname: '/broker/margins',
    });
    expect(broker).toEqual({
      allowed: true,
      membershipRole: 'owner',
      activeWorkspace: 'broker',
    });
  });

  it('allows fleet admin and denies dispatcher/finance/compliance overreach', () => {
    const fleetAdmin = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'admin',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/fleet/assignments',
    });
    expect(fleetAdmin).toEqual({
      allowed: true,
      membershipRole: 'admin',
      activeWorkspace: 'carrier_fleet',
    });

    const dispatcherFinance = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'dispatcher',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/finance/reports',
    });
    expect(dispatcherFinance).toEqual({ allowed: false, reason: 'capability_not_permitted' });

    const financeDispatch = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'finance',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/operations-centre',
    });
    expect(financeDispatch).toEqual({ allowed: false, reason: 'capability_not_permitted' });

    const complianceMargin = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'compliance',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/finance/reports',
    });
    expect(complianceMargin).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });

  it('enforces owner-operator commercial boundary and driver finance restrictions', () => {
    const employedDriver = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: 'drv-1',
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/loads',
    });
    expect(employedDriver).toEqual({ allowed: false, reason: 'capability_not_permitted' });

    const ownerOperatorQuotes = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'company_owner',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: null,
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/quotes',
    });
    expect(ownerOperatorQuotes).toEqual({ allowed: false, reason: 'capability_not_permitted' });

    const ownerOperatorFinanceForDriver = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: 'drv-2',
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/finance',
    });
    expect(ownerOperatorFinanceForDriver).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });

  it('denies cross-workspace commercial leakage', () => {
    const customerToBrokerMargins = resolveWorkspacePermission({
      companyType: 'shipper',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['shipper'],
      activeWorkspace: 'shipper',
      pathname: '/broker/margins',
    });
    expect(customerToBrokerMargins).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });

    const customerToCarrierCosts = resolveWorkspacePermission({
      companyType: 'shipper',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['shipper'],
      activeWorkspace: 'shipper',
      pathname: '/broker/carrier-costs',
    });
    expect(customerToCarrierCosts).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });

    const carrierToCompetingQuotes = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'admin',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/broker/bids',
    });
    expect(carrierToCompetingQuotes).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });

    const ownerOperatorToFleetAdmin = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      pathname: '/admin/dispatchers',
    });
    expect(ownerOperatorToFleetAdmin).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });
  });

  it('keeps route checks strict with query/fragment and traversal attempts', () => {
    const withQueryAndFragment = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs?view=active#today',
    });
    expect(withQueryAndFragment).toEqual({
      allowed: true,
      membershipRole: 'owner',
      activeWorkspace: 'carrier_fleet',
    });

    const unknownWithQuery = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/not-real?x=1#frag',
    });
    expect(unknownWithQuery).toEqual({ allowed: false, reason: 'unmapped_route' });

    const traversal = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/%2e%2e/customer/loads',
    });
    expect(traversal).toEqual({ allowed: false, reason: 'malformed_route' });
  });

  it('recalculates permissions after workspace switch with no carryover', () => {
    const brokerSession = resolveWorkspacePermission({
      companyType: null,
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['broker', 'carrier_fleet'],
      activeWorkspace: 'broker',
      pathname: '/broker/bids',
    });
    expect(brokerSession).toEqual({
      allowed: true,
      membershipRole: 'owner',
      activeWorkspace: 'broker',
    });

    const switchedToCarrier = resolveWorkspacePermission({
      companyType: null,
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['broker', 'carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/broker/bids',
    });
    expect(switchedToCarrier).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });
  });

  it('treats /driver as shared and keeps non-commercial execution paths for employed drivers', () => {
    const employedDriverJobs = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: 'drv-3',
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/jobs',
    });
    expect(employedDriverJobs).toEqual({
      allowed: true,
      membershipRole: 'driver',
      activeWorkspace: 'carrier_fleet',
    });

    const employedDriverLoads = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: 'drv-3',
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/loads',
    });
    expect(employedDriverLoads).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });

  it('denies owner-operator commercial access without explicit owner-driver facts', () => {
    const ownerWithoutProof = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'company_owner',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: null,
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/loads',
    });
    expect(ownerWithoutProof).toEqual({ allowed: false, reason: 'capability_not_permitted' });

    const ownerDriverWorkspaceFalse = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: true,
      driverId: 'drv-4',
      appAccess: true,
      driverStatus: 'active',
      pathname: '/driver/quotes',
    });
    expect(ownerDriverWorkspaceFalse).toEqual({ allowed: false, reason: 'owner_driver_proof_required' });
  });

  it('denies owner-driver commercial routes when bidding/driver facts are missing', () => {
    const noBidding = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
      ownerDriverExecutionMode: true,
      driverId: 'drv-5',
      appAccess: true,
      driverStatus: 'active',
      canCommercialBid: false,
      pathname: '/driver/quotes',
    });
    expect(noBidding).toEqual({ allowed: false, reason: 'commercial_bidding_disabled' });

    const missingDriverId = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
      ownerDriverExecutionMode: true,
      driverId: null,
      appAccess: true,
      driverStatus: 'active',
      canCommercialBid: true,
      pathname: '/driver/loads',
    });
    expect(missingDriverId).toEqual({ allowed: false, reason: 'driver_context_required' });
  });

  it('denies /driver execution and commercial access for inactive/suspended driver state or app access disabled', () => {
    const suspendedDriver = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: 'drv-6',
      appAccess: true,
      driverStatus: 'suspended',
      pathname: '/driver/jobs',
    });
    expect(suspendedDriver).toEqual({ allowed: false, reason: 'driver_inactive' });

    const appAccessDenied = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
      ownerDriverExecutionMode: true,
      driverId: 'drv-7',
      appAccess: false,
      driverStatus: 'active',
      canCommercialBid: true,
      pathname: '/driver/loads',
    });
    expect(appAccessDenied).toEqual({ allowed: false, reason: 'driver_app_access_denied' });
  });

  it('denies for inactive account/company and clears owner-driver commercial carryover after workspace switch', () => {
    const inactiveAccount = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
      ownerDriverExecutionMode: true,
      driverId: 'drv-8',
      appAccess: true,
      driverStatus: 'active',
      canCommercialBid: true,
      accountStatus: 'blocked',
      pathname: '/driver/loads',
    });
    expect(inactiveAccount).toEqual({ allowed: false, reason: 'account_inactive' });

    const inactiveCompany = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
      ownerDriverExecutionMode: true,
      driverId: 'drv-8',
      appAccess: true,
      driverStatus: 'active',
      canCommercialBid: true,
      companyStatus: 'suspended',
      pathname: '/driver/loads',
    });
    expect(inactiveCompany).toEqual({ allowed: false, reason: 'company_inactive' });

    const ownerDriverCommercial = resolveWorkspacePermission({
      companyType: null,
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator', 'carrier_fleet'],
      activeWorkspace: 'owner_operator',
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
      ownerDriverExecutionMode: true,
      driverId: 'drv-8',
      appAccess: true,
      driverStatus: 'active',
      canCommercialBid: true,
      pathname: '/driver/quotes',
    });
    expect(ownerDriverCommercial).toEqual({
      allowed: true,
      membershipRole: 'owner',
      activeWorkspace: 'owner_operator',
    });

    const switchedWorkspace = resolveWorkspacePermission({
      companyType: null,
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['owner_operator', 'carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      driverId: 'drv-8',
      appAccess: true,
      driverStatus: 'active',
      canCommercialBid: false,
      pathname: '/driver/quotes',
    });
    expect(switchedWorkspace).toEqual({ allowed: false, reason: 'capability_not_permitted' });
  });
});
