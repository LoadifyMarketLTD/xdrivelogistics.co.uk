import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('cross-workspace dashboard consistency', () => {
  const stage = read('lib/jobs/workspaceJobStage.ts');
  const customer = read('app/customer/CustomerDashboardHome.tsx');
  const tracking = read('app/customer/CustomerOperationalPages.tsx');
  const sheet = read('app/components/workspace/CompanyJobSheetPanel.tsx');
  const sheetApi = read('app/api/workspace/jobs/[jobId]/sheet/route.ts');
  const surfaces = [
    read('app/broker/BrokerDashboardHome.tsx'),
    read('app/components/workspace/CarrierOperationsDashboardHome.tsx'),
    read('app/components/workspace/DispatcherControlDashboardHome.tsx'),
    read('app/components/workspace/ViewerDashboardHome.tsx'),
    read('app/components/workspace/FleetControlDashboardHome.tsx'),
    read('app/components/workspace/ComplianceControlDashboardHome.tsx'),
    read('app/customer/diary/page.tsx'),
    read('app/components/workspace/OperationsDiaryPage.tsx'),
  ];

  it('uses one business-facing operational status vocabulary', () => {
    expect(stage).toContain('export function workspaceJobOperationalLabel');
    expect(stage).toContain("case 'on_my_way': return 'On My Way to Collection'");
    expect(stage).toContain("case 'in_transit': return 'On My Way to Delivery'");
    expect(stage).toContain("case 'quoted': return 'Quotes Received'");
    for (const surface of surfaces) expect(surface).toContain('workspaceJobOperationalLabel');
  });

  it('does not render duplicate Track actions on the customer dashboard', () => {
    expect(customer).toContain("(stage === 'allocated' || stage === 'awarded') && !pendingOffer");
    expect(customer).not.toContain("(stage === 'in_progress' || stage === 'allocated' || stage === 'awarded') && !pendingOffer");
  });

  it('separates tracking state from transport lifecycle and names expand actions clearly', () => {
    expect(tracking).toContain('const trackingState = delayed');
    expect(tracking).toContain('value="Live ETA"');
    expect(tracking).toContain('value="Awaiting live position"');
    expect(tracking).toContain("sheet ? 'Expand' : 'Details'");
    expect(tracking).toContain('actionLabel="Open full booking"');
  });

  it('separates agreement state, transport state and role-safe commercial pricing', () => {
    expect(sheetApi).toContain('agreementStatus: commercialAwardVisible ? text(agreement.agreement_status) : null');
    expect(sheet).toContain('label="Transport status"');
    expect(sheet).toContain('label="Agreement status"');
    expect(sheet).not.toContain('Lifecycle:');
    expect(sheet).toContain('label="Agreement reference"');
    expect(sheet).toContain('label="Agreed transport price"');
    expect(sheet).not.toContain('label="Contract status"');
    expect(sheet).not.toContain('label="Agreement ID"');
    expect(sheet).not.toContain('Snapshot ${sheet.commercial.contractSnapshotHash');
    expect(sheet).toContain('sheet.commercial.paymentDueDays > 0');
  });

  it('keeps shared workspace navigation free of mojibake and unstable glyphs', () => {
    const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
    expect(shell).not.toContain('\uFFFD');
    expect(shell).not.toContain('\u00e2');
    expect(shell).not.toContain('\u00c3');
    const iconValues = [...shell.matchAll(/icon: '([^']*)'/g)].map((match) => match[1]);
    expect(iconValues.every((value) => [...value].every((character) => character.charCodeAt(0) <= 127))).toBe(true);
    expect(shell).toContain("icon: 'DIR'");
    expect(shell).toContain("icon: 'FV'");
    expect(shell).toContain("icon: 'LIVE'");
    expect(shell).toContain("icon: 'FLEET'");
  });

  it('does not expose internal design/comparison language in customer or carrier dashboard copy', () => {
    const carrier = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
    expect(customer).not.toContain('same dense operational pattern as Owner Driver');
    expect(customer).not.toContain('same operational control pattern used across XDrive');
    expect(carrier).not.toContain('same operational priority CX gives recent work');
  });
});
