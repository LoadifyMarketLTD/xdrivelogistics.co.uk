import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const directoryApi = read('app/api/directory/route.ts');
const directoryUi = read('app/components/workspace/MemberDirectoryPage.tsx');
const postingForm = read('app/components/workspace/LoadPostingForm.tsx');
const createJobApi = read('app/api/jobs/create/route.ts');

describe('CX-informed Directory and Direct Booking contract', () => {
  it('enriches Directory from canonical vehicle capability without exposing live coordinates', () => {
    expect(directoryApi).toContain(".select('id, company_id, assigned_driver_id, type, has_tail_lift, pallets_capacity')");
    expect(directoryApi).toContain('vehicleServices(vehicle.type, vehicle.has_tail_lift)');
    expect(directoryApi).toContain('specialistServices');
    expect(directoryApi).toContain('maxPallets');
    expect(directoryApi).toContain('palletsCapacity');
    expect(directoryApi).not.toContain('exact_lat');
    expect(directoryApi).not.toContain('exact_lng');
  });
  it('adds CX-useful business filters without fabricating unavailable radius data', () => {
    for (const label of ['Country', 'Vehicle Size', 'Body Type', 'Phone', 'Email', 'Specialist Services', 'Tail Lift']) {
      expect(directoryUi).toContain(label);
    }
    expect(directoryApi).toContain('businessEmail: company.email ?? null');
    expect(directoryUi).toContain('businessEmail');
    expect(directoryUi).toContain('bodyType');
    expect(directoryUi).toContain('specialistService');
    expect(directoryUi).toContain('tailLiftOnly');
    expect(directoryUi).not.toContain('fakeRadius');
    expect(directoryUi).not.toContain('distanceMilesFromMember');
    expect(directoryUi).toContain('<strong>COMPANIES</strong>');
    expect(directoryUi).toContain('<strong>DRIVERS</strong>');
    expect(directoryUi).toContain('driverDirectoryPageSize = 5');
    expect(directoryUi).toContain('driverDirectoryCompanies');
    expect(directoryUi).toContain('driverDirectoryDrivers');
  });

  it('offers Book Direct from authorised Broker, Customer and Carrier member-network contexts', () => {
    expect(directoryUi).toContain("pathname.startsWith('/broker')");
    expect(directoryUi).toContain("'/broker/post-load'");
    expect(directoryUi).toContain("pathname.startsWith('/customer')");
    expect(directoryUi).toContain("'/customer/post-load'");
    expect(directoryUi).toContain("pathname.startsWith('/driver')");
    expect(directoryUi).toContain("'/driver/post-load'");
    expect(directoryUi).toContain("pathname.startsWith('/admin')");
    expect(directoryUi).toContain("'/admin/post-load'");
    expect(directoryUi).toContain('Book Direct');
    expect(directoryUi).toContain("['carrier / fleet', 'owner driver', 'standard', 'sole trader']");
    expect(directoryUi).not.toContain("'/super-admin/");
  });
  it('passes the selected carrier through the canonical load-creation path', () => {
    expect(postingForm).toContain("searchParams.get('directCarrier')");
    expect(postingForm).toContain('directInviteCompanyId: publish ? directCarrier?.id ?? null : null');
    expect(postingForm).toContain('Send Direct Booking');
    expect(postingForm).toContain('Direct invite only');
    expect(postingForm).toContain('will not be broadcast to the public XDrive Exchange');
  });

  it('validates the direct target server-side and preserves canonical visibility for single and multi-drop loads', () => {
    expect(createJobApi).toContain('directInviteCompanyId: z.string().uuid().optional().nullable()');
    expect(createJobApi).toContain("A company cannot send a Direct Booking to itself.");
    expect(createJobApi).toContain("The selected Direct Booking carrier is no longer active.");
    expect(createJobApi).toContain('const requestedVisibility = directInviteTarget');
    expect(createJobApi).toContain("? 'direct'");
    expect(createJobApi).toContain("const publishedVisibility = requestedStatus === 'draft' ? 'private' : requestedVisibility;");
    expect(createJobApi).toContain('direct_invite_company_id: directInviteTarget?.id ?? null');
    expect(createJobApi).toContain('exchange_visibility: publishedVisibility');
  });
});
