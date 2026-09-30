'use client';

import type { ReactNode } from 'react';
import TopWorkspaceShell from './TopWorkspaceShell';
import carrierStyles from './CarrierDashboard.module.css';
function Panel({
  title,
  subtitle,
  children,
  flush = false,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  flush?: boolean;
  action?: ReactNode;
}) {
  return (
    <section className={carrierStyles.panel}>
      <header className={carrierStyles.panelHeader}>
        <div className={carrierStyles.panelHeaderText}>
          <h3 className={carrierStyles.panelTitle}>{title}</h3>
          {subtitle ? <p className={carrierStyles.panelSubtitle}>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className={flush ? carrierStyles.panelBodyFlush : carrierStyles.panelBody}>{children}</div>
    </section>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className={carrierStyles.metricTile}>
      <span className={carrierStyles.metricTileLabel}>{label}</span>
      <strong className={carrierStyles.metricTileValue}>{value}</strong>
      <span className={carrierStyles.metricTileDetail}>{detail}</span>
    </div>
  );
}

function ReportLink({ label, detail }: { label: string; detail: string }) {
  return (
    <button type="button" className={carrierStyles.reportLink}>
      <span><strong>{label}</strong><small>{detail}</small></span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

function BookingCard({
  from,
  to,
  pickup,
  delivery,
  vehicle,
  status,
  id,
}: {
  from: string;
  to: string;
  pickup: string;
  delivery: string;
  vehicle: string;
  status: string;
  id: string;
}) {
  return (
    <article className={carrierStyles.bookingCard}>
      <div className={carrierStyles.bookingRoute}>
        <span><small>From</small><strong>{from}</strong></span>
        <span><small>To</small><strong>{to}</strong></span>
        <span><small>Veh</small><span>{vehicle}</span></span>
      </div>
      <div className={carrierStyles.bookingTiming}>
        <span><small>Pickup</small><strong>{pickup}</strong></span>
        <span><small>Deliver</small><strong>{delivery}</strong></span>
      </div>
      <div className={carrierStyles.bookingStatus}>
        <strong>{status}</strong>
        <span>Carrier-awarded work</span>
        <small>Job ID: {id}</small>
      </div>
      <div className={carrierStyles.bookingActions}>
        <button type="button">Open</button>
      </div>
    </article>
  );
}

export default function CarrierDashboardVisualFixture() {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <TopWorkspaceShell forcedRole="company_admin">
        <div className={carrierStyles.page} data-testid="carrier-dashboard-fixture">
          <div className={carrierStyles.cxDashboardGrid} data-testid="carrier-dashboard-grid">
            <div className={carrierStyles.cxDashboardColumn}>
              <Panel title="Reports & Statistics">
                <div className={carrierStyles.metricTileGrid}>
                  <MetricTile label="Won work value" value="£4,820" detail="Accepted carrier quotes backed by an award" />
                  <MetricTile label="Overdue receivables" value="£940" detail="2 overdue invoices" />
                </div>
              </Panel>

              <div className={carrierStyles.cxTwinPanels}>
                <Panel title="Accounts Payable">
                  <ReportLink label="Latest invoices received" detail="14 carrier invoices" />
                  <ReportLink label="Invoices due for payment" detail="4 awaiting payment" />
                  <ReportLink label="Invoices overdue" detail="2 overdue" />
                </Panel>
                <Panel title="Reports">
                  <ReportLink label="Gross margin / subcontract reporting" detail="Verified Finance reports and exports" />
                  <ReportLink label="Invoice reporting" detail="Invoice register and payment state" />
                  <ReportLink label="Won work reporting" detail="Accepted carrier work and values" />
                </Panel>
              </div>

              <Panel title="Feedback in Last 90 Days">
                <div className={carrierStyles.feedbackGrid}>
                  <div className={carrierStyles.feedbackBox}>
                    <strong>Received</strong>
                    <span>Verified feedback data is not included in the current Carrier feed.</span>
                  </div>
                  <div className={carrierStyles.feedbackBox}>
                    <strong>Given</strong>
                    <span>No rating or performance score is fabricated.</span>
                  </div>
                </div>
              </Panel>
            </div>

            <div className={carrierStyles.cxDashboardColumn}>
              <Panel
                title="Activity at a glance"
                subtitle="Latest carrier-awarded bookings"
                flush
                action={<button type="button" className={carrierStyles.panelHeaderAction}>View all…</button>}
              >
                <div className={carrierStyles.bookingList}>
                  <BookingCard from="ACCRINGTON, BB5" to="PRESTON, PR5" pickup="12:40" delivery="ASAP" vehicle="Luton" status="Delivered" id="83666897" />
                  <BookingCard from="WAKEFIELD ROAD, BARNSLEY" to="LEEDS, LS29" pickup="09:15" delivery="ASAP" vehicle="MWB up to 3m" status="Delivered" id="83633707" />
                  <BookingCard from="CROSSE HALL STREET, CHORLEY" to="MANCHESTER, M1" pickup="13:45" delivery="ASAP" vehicle="LWB up to 4m" status="Delivered" id="83563531" />
                  <BookingCard from="UNIT 602 PHOENIX PARK" to="ROCHDALE, OL12" pickup="12:00" delivery="ASAP" vehicle="LWB up to 4m" status="Delivered" id="83561111" />
                </div>
              </Panel>

              <Panel title="Compliance - Drivers & Vehicles">
                <div className={carrierStyles.complianceSummary}>
                  <button type="button" className={carrierStyles.complianceDial}>
                    <strong>4</strong>
                    <span>document alerts</span>
                  </button>
                  <div className={carrierStyles.complianceRows}>
                    <ReportLink label="Expired documents" detail="1 expired" />
                    <ReportLink label="About to expire" detail="3 due within 30 days" />
                    <ReportLink label="Unassigned vehicles" detail="2" />
                    <ReportLink label="Driver availability" detail="18 available · 9 busy" />
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </TopWorkspaceShell>
    </div>
  );
}
