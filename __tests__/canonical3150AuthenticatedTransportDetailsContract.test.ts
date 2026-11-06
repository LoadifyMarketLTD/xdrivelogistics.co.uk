import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (file: string) => readFileSync(join(process.cwd(),file),'utf8');

describe('3150 transport details use actual company job-sheet data and actions', () => {
  const sheet = source('app/components/workspace/CompanyJobSheetPanel.tsx');
  const visual = source('app/components/workspace/Canonical3150TransportSummary.tsx');
  const styles = source('app/components/workspace/canonical3150-transport-summary.css');

  it('uses the verified scoped job sheet API instead of demonstrative records', () => {
    expect(sheet).toContain('/api/workspace/jobs/');
    expect(sheet).toContain('<Canonical3150TransportSummary');
    expect(sheet).toContain('reference={sheet.references.xdrive}');
    expect(sheet).toContain('sheet.documents.length');
    expect(sheet).toContain('sheet.invoices.length');
    expect(sheet).toContain('sheet.evidence.deliveryPhotoCount + sheet.evidence.podPhotoCount');
    expect(visual).not.toContain('DEMO ONLY');
    expect(visual).not.toContain('localStorage');
  });

  it('keeps the approved six detail sections and precise two-column layout', () => {
    for(const title of [
      'Booking & Customer', 'Collection', 'Delivery',
      'Cargo & Vehicle Requirements', 'Assignment & Tracking',
      'Documents & Proof of Delivery',
    ]) expect(sheet).toContain(title);
    expect(styles).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(styles).toContain('gap:14px;');
    expect(styles).toContain('border-bottom:3px solid #ff7900');
  });

  it('keeps carrier-private addresses hidden until awarded and operator actions intact', () => {
    expect(sheet).toContain("const privateStopAccess = mode !== 'carrier'");
    expect(sheet).toContain('formatPublicOutcode(sheet.route.pickup.postcode)');
    expect(sheet).toContain('formatPublicOutcode(sheet.route.delivery.postcode)');
    expect(sheet).toContain("!privateStopAccess ?");
    expect(sheet).toContain('Available after award to authorised carriers');
    expect(sheet).toContain("sheet.commercial.carrierCost");
    expect(sheet).toContain('/api/admin/jobs/');
    expect(sheet).toContain('advanceOperatorStatus');
    expect(sheet).toContain('CommercialAmendmentControls');
    expect(sheet).toContain('JobSmartAlertsPanel');
    expect(sheet).toContain('JobOperationalExceptionsPanel');
    expect(sheet).toContain('messagesHref');
  });

  it('does not remove existing booking detail tabs for invoices/POD/status', () => {
    for(const tab of ['agreement','route','progress','exception','evidence','pod','invoice','payment','dispute','event-log'])
      expect(sheet).toContain("id: '"+tab+"'");
  });
});
