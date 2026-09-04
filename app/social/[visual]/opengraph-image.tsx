import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'XDrive Logistics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type PagePreviewConfig = {
  kicker: string;
  title: string;
  intro: string;
  cards: string[];
  active?: string;
};

const pages: Record<string, PagePreviewConfig> = {
  home: {
    kicker: 'Controlled Early Access',
    title: 'Apply to join XDrive before paid membership begins.',
    intro: 'Join a connected courier and freight platform built around posting, quoting, award, live operations, POD and finance readiness.',
    cards: ['Post & quote', 'Award work', 'Run operations', 'Close with POD'],
    active: 'Access',
  },
  platform: {
    kicker: 'Courier & Freight Exchange Platform',
    title: 'One connected workflow from posted work to proof of delivery.',
    intro: 'XDrive connects commercial exchange, award, dispatch, live status, delivery evidence and operational records around the same transport job.',
    cards: ['Post transport work', 'Compare quotes', 'Award & allocate', 'Track through POD'],
    active: 'Platform',
  },
  exchange: {
    kicker: 'XDrive Exchange',
    title: 'Post work. Find capacity. Quote with context.',
    intro: 'The XDrive Exchange is the commercial entry point for courier and freight work, keeping job requirements and operator responses connected.',
    cards: ['Post work once', 'Find capacity', 'Compare offers', 'Award with context'],
    active: 'Platform',
  },
  brokers: {
    kicker: 'XDrive for Brokers',
    title: 'Post transport work. Compare capacity. Award with control.',
    intro: 'Brokers can post courier and freight jobs, receive carrier quotes, award work and keep visibility through dispatch, POD and invoice readiness.',
    cards: ['Post work once', 'Compare real offers', 'Carry award into operations', 'Close with evidence'],
    active: 'Brokers',
  },
  customers: {
    kicker: 'For Transport Customers',
    title: 'Post transport work and keep control after award.',
    intro: 'Shippers and transport customers can post courier and freight requirements, receive quotes, award work and follow the same job through delivery evidence.',
    cards: ['Create requirement', 'Compare operators', 'Award with a record', 'Follow delivery'],
  },
  couriers: {
    kicker: 'XDrive for Couriers & Carriers',
    title: 'Find work, quote clearly and carry awarded jobs through delivery.',
    intro: 'Courier and carrier operations can discover suitable transport work, quote with context and keep awarded jobs connected through live operations and POD.',
    cards: ['Find suitable work', 'Quote with context', 'Run awarded jobs', 'Return POD'],
    active: 'Couriers',
  },
  drivers: {
    kicker: 'XDrive for Drivers',
    title: 'Run assigned work with route context, live status and POD in one place.',
    intro: 'Company drivers and operational drivers get one focused view of assigned work, collection and delivery context, ETA, exceptions and proof of delivery.',
    cards: ['Assigned job', 'Live progression', 'ETA & exceptions', 'Complete with evidence'],
    active: 'Couriers',
  },
  'owner-drivers': {
    kicker: 'XDrive for Owner Drivers',
    title: 'Find work. Quote directly. Run every awarded job through delivery.',
    intro: 'Independent owner drivers can discover suitable courier and freight work, quote directly and keep awarded work connected from collection to POD.',
    cards: ['Find work', 'Quote directly', 'Run the job', 'Return POD'],
    active: 'Couriers',
  },
  carriers: {
    kicker: 'XDrive for Carriers',
    title: 'Win work and run fleet operations from one connected job record.',
    intro: 'Courier and transport companies can discover opportunities, quote, allocate drivers and vehicles, manage live execution and retain POD and finance context.',
    cards: ['Find & win work', 'Allocate resources', 'Run live operations', 'POD & finance ready'],
    active: 'Couriers',
  },
  'join-xdrive': {
    kicker: 'Join the XDrive Network',
    title: 'Join XDrive as an owner driver, carrier, broker or transport customer.',
    intro: 'XDrive is growing a transport network around real operators and customers using one connected workflow for commercial and operational work.',
    cards: ['Owner Drivers', 'Carriers', 'Brokers', 'Customers'],
    active: 'Access',
  },
  access: {
    kicker: 'Controlled Early Access',
    title: 'Apply to join XDrive before paid membership begins.',
    intro: 'XDrive is rolling out in a controlled way so drivers, carriers, brokers and customers can join the platform before standard paid membership begins.',
    cards: ['Apply', 'Review', 'Join', '3 months free'],
    active: 'Access',
  },
  'how-it-works': {
    kicker: 'How XDrive Works',
    title: 'One transport job. One connected operational chain.',
    intro: 'The job record stays intact from posting through quoting, award, allocation, live execution, POD and commercial closure.',
    cards: ['Post', 'Quote & award', 'Operate', 'Complete'],
    active: 'Platform',
  },
  'operations-diary': {
    kicker: 'Operations Diary',
    title: 'Awarded work becomes live operations.',
    intro: 'The XDrive Operations Diary carries awarded work into allocation, route context, live status, exceptions, ETA and completion.',
    cards: ['Allocate', 'Track status', 'Handle exceptions', 'Complete'],
    active: 'Platform',
  },
  'courier-workspace': {
    kicker: 'Courier Workspace',
    title: 'Assigned work, live status and delivery evidence in one place.',
    intro: 'Owner drivers and company drivers get a focused operational view of the jobs they are responsible for, from assignment through proof of delivery.',
    cards: ['Assigned work', 'Route context', 'Live status', 'POD'],
    active: 'Couriers',
  },
  'pod-records': {
    kicker: 'POD & Records',
    title: 'Delivery evidence stays attached to the job.',
    intro: 'Proof of delivery and completion evidence stay connected to the job, driver, timing and operational history instead of becoming separate files.',
    cards: ['Delivery evidence', 'Timestamps', 'Job history', 'Completion record'],
    active: 'Platform',
  },
  finance: {
    kicker: 'Finance & Invoice Readiness',
    title: 'Operational records that are ready for finance.',
    intro: 'Commercial and delivery context stays connected so completed jobs can move into invoice preparation and financial follow-up with a reliable record.',
    cards: ['Completed job', 'POD context', 'Invoice readiness', 'Commercial record'],
    active: 'Platform',
  },
};

const pricingPlans = [
  ['Owner Driver', '£29.99'],
  ['Customer / Shipper', '£29.99'],
  ['Small Carrier', '£59.99'],
  ['Broker', '£79.99'],
] as const;

function SiteHeader({ active }: { active?: string }) {
  const nav = ['Platform', 'Brokers', 'Couriers', 'Pricing', 'Access'];
  return (
    <div style={{ height: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 58px', background: '#fff', borderBottom: '1px solid #DDE5EF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F5A300', color: '#102B55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 900 }}>XD</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#163568' }}>XDrive Logistics</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#60758F' }}>Courier & Freight Exchange Platform</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 23, fontSize: 14, fontWeight: 900, color: '#163568' }}>
        {nav.map(item => <span key={item} style={{ color: item === active ? '#F5A300' : '#163568' }}>{item}</span>)}
        <span style={{ borderRadius: 8, background: '#163568', color: '#fff', padding: '10px 14px' }}>Start 3 Months Free</span>
      </div>
    </div>
  );
}

function PagePreview({ config }: { config: PagePreviewConfig }) {
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#F4F6FA', color: '#102447', fontFamily: 'Arial,sans-serif' }}>
      <SiteHeader active={config.active} />
      <div style={{ height: 340, display: 'flex', flexDirection: 'column', padding: '38px 62px 30px', background: 'linear-gradient(135deg,#163568 0%,#102B55 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', color: '#F5A300' }}>EARLY ACCESS · FIRST 3 MONTHS FREE</div>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.16em', color: '#F5A300' }}>{config.kicker.toUpperCase()}</div>
        </div>
        <div style={{ marginTop: 15, maxWidth: 1030, fontSize: 46, lineHeight: 0.98, fontWeight: 900, letterSpacing: '-0.035em' }}>{config.title}</div>
        <div style={{ marginTop: 15, maxWidth: 970, fontSize: 17, lineHeight: 1.4, fontWeight: 700, color: '#D8E4F3' }}>{config.intro}</div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ borderRadius: 8, background: '#F5A300', color: '#102B55', padding: '10px 16px', fontSize: 13, fontWeight: 900 }}>Start 3 Months Free</span>
          <span style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,.18)', color: '#fff', padding: '9px 16px', fontSize: 13, fontWeight: 900 }}>Sign In</span>
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: '#D8E4F3' }}>✓ No XDrive commission   ✓ No booking fee   ✓ Monthly rolling after trial</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '24px 48px 28px', background: 'linear-gradient(180deg,#F8FAFD 0%,#EEF3F8 100%)' }}>
        {config.cards.map((card, index) => (
          <div key={card} style={{ flex: 1, minHeight: 150, display: 'flex', flexDirection: 'column', borderRadius: 18, border: '1px solid #1B3D6B', background: 'linear-gradient(135deg,#163568 0%,#102B55 100%)', padding: '17px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', color: '#F5A300' }}>XDRIVE FLOW · 0{index + 1}</span>
              <span style={{ fontSize: 34, fontWeight: 900, color: '#46689F' }}>0{index + 1}</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 20, lineHeight: 1.1, fontWeight: 900 }}>{card}</div>
            <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,.10)', paddingTop: 10, fontSize: 11, fontWeight: 800, color: '#D8E4F3' }}>Connected to the same transport job record</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingPreview() {
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#F4F6FA', color: '#102447', fontFamily: 'Arial,sans-serif' }}>
      <SiteHeader active="Pricing" />
      <div style={{ height: 245, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '34px 62px', background: 'linear-gradient(135deg,#173B73 0%,#0E2D5A 100%)', color: '#fff' }}>
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.16em', color: '#F5A300' }}>XDRIVE MEMBERSHIP</div>
        <div style={{ marginTop: 13, fontSize: 52, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.035em' }}>Simple pricing. First 3 months free.</div>
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: '#D8E4F3' }}>No XDrive commission on job value. No XDrive booking fee. Monthly rolling after the free period.</div>
      </div>
      <div style={{ flex: 1, display: 'flex', padding: '26px 48px 30px', gap: 14, background: 'linear-gradient(180deg,#F8FAFD 0%,#EEF3F8 100%)' }}>
        {pricingPlans.map(([name, price]) => (
          <div key={name} style={{ flex: 1, minHeight: 190, display: 'flex', flexDirection: 'column', borderRadius: 18, border: '1px solid #F5A300', background: 'linear-gradient(135deg,#173B73 0%,#0E2D5A 100%)', padding: 18, color: '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.11em', color: '#F5A300' }}>XDRIVE MEMBERSHIP</div>
            <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900 }}>{name}</div>
            <div style={{ marginTop: 18, fontSize: 31, fontWeight: 900 }}>{price}<span style={{ marginLeft: 6, fontSize: 11, color: '#D8E4F3' }}>/ month + VAT</span></div>
            <div style={{ marginTop: 14, display: 'flex', width: 'fit-content', borderRadius: 999, border: '1px solid rgba(245,163,0,.45)', background: 'rgba(245,163,0,.10)', padding: '6px 9px', fontSize: 10, fontWeight: 900, color: '#F5A300' }}>FIRST 3 MONTHS FREE</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ visual: string }> }) {
  const { visual } = await params;
  const key = visual.replace(/-v2$/, '');

  if (key === 'pricing') {
    return new ImageResponse(<PricingPreview />, { width: 1200, height: 630 });
  }

  const config = pages[key] ?? pages.platform;
  return new ImageResponse(<PagePreview config={config} />, { width: 1200, height: 630 });
}
