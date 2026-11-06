import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('3150 transport details retain authoritative booking data and operations', () => {
  const panel = read('app/components/workspace/CompanyJobSheetPanel.tsx');
  const component = read('app/components/workspace/Canonical3150TransportSummary.tsx');
  const css = read('app/components/workspace/canonical3150-transport-summary.css');

  it('uses a single verified reference, actual status and real job detail API', () => {
    expect(panel).toContain('<Canonical3150TransportSummary');
    expect(panel).toContain('reference={sheet.references.xdrive}');
    expect(panel).toContain('status={presentationStatus}');
    expect(panel).toContain('sheet.route.pickup.postcode');
    expect(panel).toContain('sheet.route.delivery.postcode');
    expect(panel).toContain('/api/');
    expect(component).toContain('aria-label="Verified transport details"');
    expect(component).not.toContain('DEMO ONLY');
  });

  it('presents all six sections of the approved transport details', () => {
    for (const heading of [
      'Booking & Customer', 'Collection', 'Delivery',
      'Cargo & Vehicle Requirements', 'Assignment & Tracking',
      'Documents & Proof of Delivery',
    ]) expect(panel).toContain(heading);
    expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(css).toContain('border-bottom:3px solid #ff7900');
  });

  it('does not show a private carrier cost as the customer agreed price', () => {
    expect(panel).toContain('const customerAgreedPrice = sheet.commercial.agreedGross ?? sheet.commercial.customerPrice;');
    expect(panel).not.toContain('const customerAgreedPrice = sheet.commercial.agreedGross ?? sheet.commercial.carrierCost;');
  });

  it('does not disclose unawarded addresses and contacts to unauthorized carriers', () => {
    expect(panel).toContain('const privateStopAccess =');
    expect(panel).toContain('sheet.viewerCompanyId === sheet.ownerCompany.companyId');
    expect(panel).toContain('sheet.viewerCompanyId === sheet.carrier?.companyId');
    expect(panel).toContain('!privateStopAccess');
    expect(panel).toContain('formatPublicOutcode');
    expect(panel).toContain('Available after award to authorised carriers');
    expect(panel).toContain('Private until award');
  });

  it('does not mix duplicate legacy panels into the default 3150 six-section display', () => {
    expect(panel).toContain('<details className="xdrive3150-real-transport__extended">');
    expect(panel).toContain('<summary>Full commercial agreement, amendments and adjustments</summary>');
    expect(css).toContain('.xdrive3150-real-transport__extended>summary');
    expect(panel).toContain('CommercialAmendmentControls');
  });

  it('keeps status, evidence, invoices, documents, dispute, and event log tabs', () => {
    for (const id of ["'progress'", "'evidence'", "'pod'", "'invoice'", "'payment'", "'dispute'", "'event-log'"]) {
      expect(panel).toContain(id);
    }
    expect(panel).toContain('advanceOperatorStatus');
    expect(panel).toContain('operatorTransitionBlocked');
    expect(panel).toContain('podCompleteForOperator');
    expect(panel).toContain('WorkspaceJobReplay');
    expect(panel).toContain('CommercialAmendmentControls');
  });

  it('shows an unavailable field explicitly rather than invented values', () => {
    expect(component).toContain("value || 'Not recorded'");
    expect(panel).toContain('sheet.partial && <AlertBanner');
  });
});
