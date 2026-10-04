import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX company operational settings parity contract', () => {
  const migration = read('supabase/migrations/20260927172500_cx_company_operational_settings.sql');
  const operationsRoute = read('app/api/settings/company-operations/route.ts');
  const operationsPanel = read('app/components/workspace/CompanyOperationsSettingsPanel.tsx');
  const blockedRoute = read('app/api/settings/company-blocked-members/route.ts');
  const blockedPanel = read('app/components/workspace/CompanyBlockedMembersPanel.tsx');
  const settingsWorkspace = read('app/components/workspace/RoleSettingsWorkspace.tsx');
  const financePanel = read('app/components/workspace/CompanyFinanceSettingsPanel.tsx');
  const blocks = read('app/api/_lib/companyBlocks.ts');
  const bidEligibility = read('app/api/driver/_lib/bidEligibility.ts');
  const submitQuote = read('app/api/driver/_lib/submitQuote.ts');
  const jobCreate = read('app/api/jobs/create/route.ts');
  const jobManage = read('app/api/admin/jobs/[id]/manage/route.ts');
  const adminBidAccept = read('app/api/admin/bids/[id]/accept/route.ts');
  const award = read('app/api/customer/bids/[id]/award/route.ts');
  const message = read('app/api/customer/bids/[id]/message/route.ts');
  const driverLoads = read('app/api/driver/marketplace/loads/route.ts');
  const companyMarketplace = read('app/api/marketplace/company/route.ts');
  const directory = read('app/api/directory/route.ts');
  const memberProfileRoute = read('app/api/member-profile/[companyId]/route.ts');
  const memberProfile = read('app/components/workspace/MemberProfile.tsx');

  it('adds the company operations settings evidenced in the CX reference without duplicating canonical payment terms', () => {
    for (const column of [
      'operator_licence_number',
      'finance_email',
      'secondary_phone',
      'email_visible_to_members',
      'home_location',
      'directory_location',
      'booking_footer',
      'delivery_note_company_name',
      'delivery_note_customer_phone',
      'delivery_note_driver_phone',
      'delivery_note_footer',
      'waiting_time_terms',
      'loading_time_terms',
      'cancellation_terms',
      'other_charges',
      'feedback_view_days',
      'driver_must_confirm_acceptance',
      'allow_load_reminder',
      'show_notification_bar',
      'show_average_speed_replay',
      'accept_electronic_quotes',
      'accept_quotes_approved_members_only',
      'accept_international_quotes',
      'receive_quote_email_notifications',
      'show_full_postcode_posted_loads',
    ]) expect(migration).toContain(column);

    expect(financePanel).toContain('Payment terms');
    expect(financePanel).toContain('COMPANY_CONFIG.payment.terms');
    expect(migration).not.toContain('ADD COLUMN IF NOT EXISTS default_payment_terms');
  });

  it('exposes the CX-derived company operations sections to company owners/admins but not Fleet Manager', () => {
    expect(settingsWorkspace).toContain("const companyOperationsVisible = canEditCompany && (role === 'carrier' || role === 'owner')");
    expect(settingsWorkspace).toContain("label: 'Company Operations'");
    expect(settingsWorkspace).toContain("label: 'Blocked Members'");
    expect(settingsWorkspace).toContain('<CompanyOperationsSettingsPanel');
    expect(settingsWorkspace).toContain('<CompanyBlockedMembersPanel');
    expect(operationsRoute).toContain("const adminRoles = new Set(['owner', 'admin'])");
    expect(blockedRoute).toContain("const adminRoles = new Set(['owner', 'admin'])");
    expect(settingsWorkspace).not.toContain("companyOperationsVisible = role === 'fleet'");
  });

  it('provides the operational fields and CX-style specialist service catalogue in the UI', () => {
    for (const label of [
      "Operator&apos;s Licence",
      'Finance Email',
      'Home Location',
      'Directory Location',
      'Booking Footer',
      'Delivery Note Details',
      'Waiting Time',
      'Loading Time',
      'Cancellation',
      'Specialist Services',
      '24 Hour',
      'ADR',
      'DGSA Qualified',
      'FORS Bronze',
      'FORS Silver',
      'FORS Gold',
      'Frozen',
      'High Security',
      'Refrigerated / Chilled',
      'Waste Carrier',
      'WEEE',
      'Authorised Economic Operator (AEO)',
      'CMR',
      'Exchange Preferences',
    ]) expect(operationsPanel).toContain(label);
  });

  it('separates declaration from verification for regulated specialist capabilities', () => {
    expect(migration).toContain("verification_status IN ('declared','pending','verified','rejected')");
    expect(operationsRoute).toContain('const REGULATED_CODES');
    expect(operationsRoute).toContain("verification_status: verificationRequired ? 'pending' : 'declared'");
    expect(operationsPanel).toContain('Regulated accreditations stay pending until separately verified');
    expect(directory).toContain("if (verificationRequired && status !== 'verified') continue");
  });

  it('implements owner/admin company member blocking with bidirectional commercial enforcement', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_member_blocks');
    expect(blockedPanel).toContain('Block a Member');
    expect(blockedPanel).toContain('Blocked Members');
    expect(blockedPanel).toContain('Unblock');
    expect(blockedRoute).toContain('blocker_company_id');
    expect(blockedRoute).toContain('blocked_company_id');
    expect(blocks).toContain(".from('company_member_blocks')");
    expect(blocks).toContain('blocked_company_id');
    expect(blocks).toContain('blocker_company_id');
  });

  it('enforces blocks across quote, direct booking, award, messaging and marketplace visibility', () => {
    expect(bidEligibility).toContain("denialReasons.push('company_interaction_blocked')");
    expect(submitQuote).toContain('Commercial interaction with this company is blocked.');
    expect(jobCreate).toContain('Direct Booking is unavailable because commercial interaction between these companies is blocked.');
    expect(jobManage).toContain('Direct Booking is unavailable because commercial interaction between these companies is blocked.');
    expect(adminBidAccept).toContain('This quote cannot be awarded because commercial interaction between these companies is blocked.');
    expect(award).toContain('This quote cannot be awarded because commercial interaction between these companies is blocked.');
    expect(message).toContain('Messaging is unavailable because commercial interaction between these companies is blocked.');
    expect(driverLoads).toContain('blockedResult.ids.has(companyId)');
    expect(companyMarketplace).toContain('getBlockedCounterpartyCompanyIds');
    expect(companyMarketplace).toContain('Commercial interaction with this company is blocked.');
    expect(directory).toContain('.filter((company) => !blockedResult.ids.has(String(company.id)))');
  });

  it('publishes configured member-facing services, charges and booking footer instead of placeholder tabs', () => {
    expect(memberProfileRoute).toContain(".from('company_settings')");
    for (const field of ['booking_footer', 'waiting_time_terms', 'loading_time_terms', 'cancellation_terms', 'other_charges']) {
      expect(memberProfileRoute).toContain(field);
    }
    expect(memberProfileRoute).toContain(".from('company_specialist_capabilities')");
    expect(memberProfileRoute).toContain("row.verification_required !== true || String(row.verification_status ?? '').toLowerCase() === 'verified'");
    expect(memberProfileRoute).toContain("state: 'available'");
    expect(memberProfileRoute).toContain('items: publicSpecialists');
    expect(memberProfileRoute).toContain('items: chargeLines');
    expect(memberProfileRoute).toContain('settings?.booking_footer');
    expect(memberProfileRoute).toContain('areCompaniesBlocked');
    expect(memberProfileRoute).toContain(".from('reviews')");
    expect(memberProfileRoute).toContain('feedbackItems.length');
    expect(memberProfileRoute).toContain('verified job feedback record');
    expect(memberProfile).toContain("section.state === 'available' && section.items?.length");
  });

  it('keeps company operational preferences owner/admin scoped server-side', () => {
    expect(operationsRoute).toContain('requireCompanyAdmin');
    expect(operationsRoute).toContain("Company owner or admin access is required for company operations settings.");
    expect(operationsRoute).toContain("feedbackViewDays: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(180), z.literal(365)])");
    expect(operationsRoute).toContain('acceptQuotesApprovedMembersOnly');
    expect(operationsRoute).toContain('showFullPostcodePostedLoads');
  });
});
