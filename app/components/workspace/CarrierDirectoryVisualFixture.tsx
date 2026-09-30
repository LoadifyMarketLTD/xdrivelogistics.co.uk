'use client';

import TopWorkspaceShell from './TopWorkspaceShell';
import { ActionButton } from './WorkspaceUI';

const Row = ({ name, location, type, capability, reliability }: { name: string; location: string; type: string; capability: string; reliability: string }) => (
  <article className="workspace-operational-row directory-operational-row">
    <div className="workspace-operational-row__top directory-operational-row__top">
      <div className="workspace-operational-cell"><div className="driver-cell-label">MEMBER</div><strong>{name}</strong><div className="driver-cell-secondary">Member ID XD-001564</div></div>
      <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{location}</strong><div className="driver-cell-secondary">United Kingdom</div></div>
      <div className="workspace-operational-cell"><div className="driver-cell-label">TYPE / CAPABILITY</div><strong>{type}</strong><div className="driver-cell-secondary">{capability}</div></div>
      <div className="workspace-operational-cell"><div className="driver-cell-label">DELIVERY / PAYMENT RELIABILITY</div><strong>{reliability}</strong><div className="driver-cell-secondary">Verified evidence only</div></div>
      <div className="workspace-operational-cell"><div className="driver-cell-label">ACTION</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><ActionButton tone="secondary">Messages</ActionButton><ActionButton tone="success">Book Direct</ActionButton></div></div>
    </div>
  </article>
);

export default function CarrierDirectoryVisualFixture() {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <TopWorkspaceShell forcedRole="company_admin">
        <div className="directory-workspace" data-testid="carrier-directory-fixture">
          <div className="directory-register-header" data-testid="directory-header">
            <div><strong>Directory</strong><span>Carrier member network</span></div>
            <ActionButton tone="secondary">Refresh</ActionButton>
          </div>
          <div className="workspace-board-layout" data-testid="directory-layout">
            <aside className="workspace-filter-rail" aria-label="Directory filters">
              <div className="workspace-filter-rail__header">Search Directory</div>
              <div className="workspace-filter-rail__body">
                <label>MEMBER / XDRIVE ID<input placeholder="Company, driver or XDrive member ID" /></label>
                <label>LOCATION<input placeholder="Town / postcode / country" /></label>
                <label>RADIUS<select defaultValue="50"><option value="50">50 miles</option></select></label>
                <label>VEHICLE TYPE<input placeholder="LWB, Luton, Artic…" /></label>
                <label>SPECIALIST SERVICE<select defaultValue=""><option value="">Any service</option></select></label>
                <ActionButton tone="success">Find My Nearest</ActionButton>
                <ActionButton tone="secondary">Clear</ActionButton>
              </div>
            </aside>
            <main style={{ minWidth: 0 }}>
              <div className="workspace-tab-strip" role="tablist" aria-label="Directory member types" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
                <button type="button" data-active="true">Companies 2</button>
                <button type="button" data-active="false">Drivers 8</button>
              </div>
              <div className="workspace-record-meta directory-register-meta">
                <span><strong>2</strong> matching loaded record(s)</span>
                <span>Click a company identity for Member Profile</span>
                <span className="directory-pagination"><label>Items per Page<select defaultValue="25"><option value="25">25</option></select></label><span>1-2 of 2</span></span>
              </div>
              <div className="workspace-record-list">
                <Row name="XDrive Logistics Ltd" location="Blackburn, BB1" type="Carrier / Fleet" capability="Luton, LWB · Tail Lift" reliability="Delivery 96%" />
                <Row name="Northern Same Day Ltd" location="Manchester, M1" type="Owner Driver" capability="LWB · Same day" reliability="Delivery 94%" />
              </div>
            </main>
          </div>
        </div>
      </TopWorkspaceShell>
    </div>
  );
}
