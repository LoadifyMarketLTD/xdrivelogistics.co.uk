'use client';

import WorkspaceShell from './WorkspaceShell';
import styles from './WorkspaceUI.module.css';
import {
  ActionButton,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalCard,
  OperationalFilterField,
  OperationalFilters,
  OperationalMetricList,
  OperationalPageLayout,
  PageHeader,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';

type FixtureJob = {
  id: string;
  status: string;
  current_status?: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
};

type FixtureDocument = {
  id: string;
  doc_type?: string | null;
  expiry_date: string | null;
};

type FixtureQuote = {
  id: string;
  bid_price_gbp: number | null;
  status: string;
  created_at: string;
  jobs?: {
    pickup_location: string | null;
    delivery_location: string | null;
  }[] | null;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const BID_STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'grey',
};

const TODAY_JOBS: FixtureJob[] = [
  {
    id: 'driver-job-live',
    status: 'allocated',
    current_status: 'on_my_way_to_pickup',
    pickup_location: 'Leicester Hub',
    delivery_location: 'Coventry Depot',
    pickup_datetime: '2026-08-03T08:30:00.000Z',
    delivery_datetime: '2026-08-03T10:45:00.000Z',
    vehicle_type: 'luton_van',
  },
  {
    id: 'driver-job-2',
    status: 'allocated',
    current_status: 'accepted',
    pickup_location: 'Birmingham Trade Gate',
    delivery_location: 'Wolverhampton Estate',
    pickup_datetime: '2026-08-03T12:15:00.000Z',
    delivery_datetime: '2026-08-03T14:00:00.000Z',
    vehicle_type: 'sprinter',
  },
  {
    id: 'driver-job-3',
    status: 'allocated',
    current_status: 'accepted',
    pickup_location: 'Nottingham Retail Park',
    delivery_location: 'Derby City Centre',
    pickup_datetime: '2026-08-03T15:30:00.000Z',
    delivery_datetime: '2026-08-03T17:10:00.000Z',
    vehicle_type: 'sprinter',
  },
];

const UPCOMING_JOBS: FixtureJob[] = [
  {
    id: 'driver-job-upcoming-1',
    status: 'allocated',
    current_status: 'accepted',
    pickup_location: 'Sheffield Industrial',
    delivery_location: 'Leeds Cross Dock',
    pickup_datetime: '2026-08-04T07:45:00.000Z',
    delivery_datetime: '2026-08-04T09:35:00.000Z',
    vehicle_type: 'luton_van',
  },
  {
    id: 'driver-job-upcoming-2',
    status: 'allocated',
    current_status: 'accepted',
    pickup_location: 'Milton Keynes Parts Hub',
    delivery_location: 'Northampton DC',
    pickup_datetime: '2026-08-05T09:00:00.000Z',
    delivery_datetime: '2026-08-05T10:25:00.000Z',
    vehicle_type: 'sprinter',
  },
];

const RECENT_COMPLETED: FixtureJob[] = [
  {
    id: 'driver-job-complete-1',
    status: 'delivered',
    current_status: 'delivered',
    pickup_location: 'Luton Consolidation',
    delivery_location: 'Bedford Trade',
    pickup_datetime: '2026-08-02T08:05:00.000Z',
    delivery_datetime: '2026-08-02T09:20:00.000Z',
    vehicle_type: 'sprinter',
  },
  {
    id: 'driver-job-complete-2',
    status: 'paid',
    current_status: 'paid',
    pickup_location: 'Manchester Freight',
    delivery_location: 'Stockport Retail',
    pickup_datetime: '2026-08-01T10:10:00.000Z',
    delivery_datetime: '2026-08-01T12:40:00.000Z',
    vehicle_type: 'luton_van',
  },
];

const EXPIRING_DOCUMENTS: FixtureDocument[] = [
  { id: 'doc-1', doc_type: 'Operator licence', expiry_date: '2026-08-08T00:00:00.000Z' },
  { id: 'doc-2', doc_type: 'Vehicle insurance', expiry_date: '2026-08-18T00:00:00.000Z' },
];

const MY_QUOTES: FixtureQuote[] = [
  {
    id: 'quote-1',
    bid_price_gbp: 286,
    status: 'submitted',
    created_at: '2026-08-02T13:20:00.000Z',
    jobs: [{ pickup_location: 'Coventry Parts', delivery_location: 'Stoke Trade' }],
  },
  {
    id: 'quote-2',
    bid_price_gbp: 412,
    status: 'accepted',
    created_at: '2026-08-02T09:05:00.000Z',
    jobs: [{ pickup_location: 'Reading Commerce', delivery_location: 'Slough Hub' }],
  },
  {
    id: 'quote-3',
    bid_price_gbp: 194,
    status: 'withdrawn',
    created_at: '2026-08-01T16:50:00.000Z',
    jobs: [{ pickup_location: 'Tamworth Depot', delivery_location: 'Coventry Market' }],
  },
];

const navigate = () => undefined;

export default function DriverDashboardVisualFixture() {
  const ownerDriver = true;
  const currentJob = TODAY_JOBS[0];
  const completedJobs = 14;
  const submittedQuotes = MY_QUOTES.filter((quote) => quote.status === 'submitted').length;
  const wonWork = MY_QUOTES.filter((quote) => quote.status === 'accepted').length;
  const pendingInvoices = 2;
  const dashboardKpis = [
    { label: 'Jobs today', value: TODAY_JOBS.length, detail: 'Scheduled collections', onClick: navigate },
    { label: 'Active job', value: 1, detail: 'Current execution', tone: 'green' as const, onClick: navigate },
    { label: 'Awaiting start', value: UPCOMING_JOBS.length, detail: 'Allocated, not yet active', tone: 'orange' as const },
    { label: 'Completed', value: completedJobs, detail: 'Delivered or invoiced', tone: 'navy' as const, onClick: navigate },
    {
      label: 'Documents expiring',
      value: EXPIRING_DOCUMENTS.length,
      detail: 'Within 30 days',
      tone: 'red' as const,
      onClick: navigate,
    },
    {
      label: 'Quotes submitted',
      value: submittedQuotes,
      detail: 'Awaiting customer decision',
      tone: 'blue' as const,
      onClick: navigate,
    },
  ];

  return (
    <WorkspaceShell
      forcedRole="driver"
      fixtureOverrides={{
        companyName: 'XDrive Owner Driver',
        unreadCount: 3,
        tickerItems: [
          { id: 'driver-fx-1', label: 'Customer confirmed quote', reference: 'Q-1028', created_at: '2026-08-03T08:55:00.000Z', href: '/driver/quotes' },
          { id: 'driver-fx-2', label: 'Vehicle insurance expiring soon', reference: 'DOC-22', created_at: '2026-08-03T09:05:00.000Z', href: '/driver/documents' },
        ],
      }}
    >
      <OperationalPageLayout
        searchPanel={(
          <OperationalFilters title="Owner-driver control desk">
            <OperationalFilterField label="Shift picture">
              <OperationalMetricList
                items={[
                  { label: 'Jobs today', value: TODAY_JOBS.length, tone: 'green' },
                  { label: 'Current job', value: 1, tone: 'green' },
                  { label: 'Upcoming work', value: UPCOMING_JOBS.length, tone: 'orange' },
                  { label: 'Documents expiring', value: EXPIRING_DOCUMENTS.length, tone: 'red' },
                ]}
              />
            </OperationalFilterField>
            <OperationalFilterField label="Quick actions">
              <QuickActionGrid
                actions={[
                  { key: 'find-loads', label: 'Find loads', onClick: navigate },
                  { key: 'jobs', label: 'Open jobs', onClick: navigate },
                  { key: 'availability', label: 'Update availability', onClick: navigate },
                  { key: 'documents', label: 'Manage documents', onClick: navigate },
                ]}
              />
            </OperationalFilterField>
          </OperationalFilters>
        )}
      >
        <PageHeader
          eyebrow="Owner-driver business"
          title="Owner Driver Dashboard"
          description="Find work, manage quotes, execute jobs, capture POD and move completed work into finance."
          actions={(
            <>
              <ActionButton tone="success" onClick={navigate}>Find loads</ActionButton>
              <ActionButton tone="secondary" onClick={navigate}>Availability</ActionButton>
              <ActionButton tone="secondary" onClick={navigate}>Documents</ActionButton>
            </>
          )}
        />

        <KpiGrid>
          {dashboardKpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              detail={kpi.detail}
              tone={kpi.tone}
              onClick={kpi.onClick}
            />
          ))}
        </KpiGrid>

        <TwoColumn>
          <OperationalCard
            title={currentJob ? 'Current job' : 'Next operational work'}
            subtitle="The job card shows the authoritative route, timing and next driver action."
            actions={<ActionButton tone="secondary" onClick={navigate}>All jobs</ActionButton>}
          >
            {currentJob ? (
              <div className={styles.driverDashboardCurrentJob}>
                <div>
                  <strong className={styles.driverDashboardRoute}>
                    {currentJob.pickup_location ?? 'Collection'} → {currentJob.delivery_location ?? 'Delivery'}
                  </strong>
                  <span className={styles.driverDashboardMeta}>
                    Pickup {formatDateTime(currentJob.pickup_datetime)} · Delivery {formatDateTime(currentJob.delivery_datetime)}
                  </span>
                </div>
                <StatusBadge value={currentJob.current_status ?? currentJob.status} />
                <ActionButton tone="success" onClick={navigate}>Open job and actions</ActionButton>
              </div>
            ) : (
              <EmptyState title="No active job" description="Assigned work appears here as soon as it is allocated." />
            )}
          </OperationalCard>

          <OperationalCard title="Today's schedule" subtitle="All collections scheduled for today in pickup-time order." flush>
            <DataTable
              columns={['Route', 'Pickup', 'Status', 'Action']}
              rows={TODAY_JOBS.map((job) => [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                formatDateTime(job.pickup_datetime),
                <StatusBadge key="status" value={job.current_status ?? job.status} />,
                <ActionButton key="action" tone="secondary" onClick={navigate}>Open</ActionButton>,
              ])}
            />
          </OperationalCard>
        </TwoColumn>

        <TwoColumn>
          <OperationalCard title="Readiness summary" subtitle="Operational shortcuts and account readiness for the next shift.">
            <div className={styles.roleDashboardSummaryList}>
              {[
                ['Upcoming allocated work', UPCOMING_JOBS.length],
                ['Jobs completed', completedJobs],
                ['Documents expiring', EXPIRING_DOCUMENTS.length],
                ['Quote pipeline', submittedQuotes + wonWork],
              ].map(([label, value]) => (
                <button key={String(label)} type="button" onClick={navigate} className={styles.roleDashboardSummaryButton}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
          </OperationalCard>

          <OperationalCard title="Recent completed work" subtitle="Delivered jobs and POD-ready history." flush>
            <DataTable
              columns={['Route', 'Delivered', 'Status', 'Action']}
              rows={RECENT_COMPLETED.map((job) => [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                formatDateTime(job.delivery_datetime),
                <StatusBadge key="status" value={job.current_status ?? job.status} />,
                <ActionButton key="action" tone="secondary" onClick={navigate}>Open</ActionButton>,
              ])}
            />
          </OperationalCard>
        </TwoColumn>

        <OperationalCard title="Upcoming allocated work" subtitle="Jobs already allocated to you scheduled for future dates." actions={<ActionButton tone="secondary" onClick={navigate}>All jobs</ActionButton>} flush>
          <DataTable
            columns={['Route', 'Pickup date', 'Vehicle', 'Status', 'Action']}
            rows={UPCOMING_JOBS.map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDateTime(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={navigate}>Open</ActionButton>,
            ])}
          />
        </OperationalCard>

        {ownerDriver && (
          <TwoColumn>
            <OperationalCard
              title="Recent marketplace activity"
              subtitle="Your latest quote submissions and their commercial outcomes."
              actions={<ActionButton tone="secondary" onClick={navigate}>All quotes</ActionButton>}
              flush
            >
              <DataTable
                columns={['Route', 'Your quote', 'Submitted', 'Result']}
                rows={MY_QUOTES.map((bid) => {
                  const job = Array.isArray(bid.jobs) ? bid.jobs[0] : bid.jobs;
                  return [
                    <strong key="route">{job?.pickup_location ?? 'Collection'} → {job?.delivery_location ?? 'Delivery'}</strong>,
                    money(Number(bid.bid_price_gbp ?? 0)),
                    formatDateTime(bid.created_at),
                    <StatusBadge key="status" value={bid.status} tone={BID_STATUS_TONE[bid.status]} />,
                  ];
                })}
              />
            </OperationalCard>

            <div className={styles.roleDashboardColumn}>
              <OperationalCard title="Business summary" subtitle="Financial and operational position for your owner-driver account.">
                <div className={styles.roleDashboardSummaryList}>
                  {[
                    ['Quotes submitted', submittedQuotes],
                    ['Won work (accepted)', wonWork],
                    ['Pending invoices', pendingInvoices],
                    ['Return journeys', null],
                    ['Documents & compliance', null],
                  ].map(([label, value]) => (
                    <button key={String(label)} type="button" onClick={navigate} className={styles.roleDashboardSummaryButton}>
                      <span>{label}</span>
                      {value !== null && <strong>{value}</strong>}
                    </button>
                  ))}
                </div>
              </OperationalCard>

              <OperationalCard title="Document expiry alerts" subtitle="Take action before these documents expire.">
                <div className={styles.driverDashboardAlertList}>
                  {EXPIRING_DOCUMENTS.map((doc) => {
                    const days = Math.ceil((new Date(doc.expiry_date!).getTime() - Date.now()) / 86_400_000);
                    return (
                      <div key={doc.id} className={styles.roleDashboardListRow}>
                        <span>{doc.doc_type?.replace(/_/g, ' ') ?? 'Document'}</span>
                        <StatusBadge value={days <= 0 ? 'Expired' : `${days} days`} tone={days <= 7 ? 'red' : 'orange'} />
                      </div>
                    );
                  })}
                </div>
                <div className={styles.driverDashboardAlertAction}>
                  <ActionButton tone="secondary" onClick={navigate}>Manage documents</ActionButton>
                </div>
              </OperationalCard>
            </div>
          </TwoColumn>
        )}
      </OperationalPageLayout>
    </WorkspaceShell>
  );
}
