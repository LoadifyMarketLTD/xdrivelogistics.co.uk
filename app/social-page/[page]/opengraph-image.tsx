import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'XDrive Logistics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type PagePreview = {
  kicker: string;
  title: string;
  intro: string;
  nav?: string;
  cards: Array<{ title: string; copy: string }>;
};

const pages: Record<string, PagePreview> = {
  home: { kicker: 'COURIER & FREIGHT EXCHANGE PLATFORM', title: 'Move Freight. Manage Operations. Grow Your Network.', intro: 'Posted work, quotes, awarded jobs, dispatch, POD and invoice readiness in one controlled workflow.', nav: 'Platform', cards: [{ title: 'Post & quote', copy: 'Create transport work and receive courier quotes.' }, { title: 'Award & deliver', copy: 'Allocate work, track status and complete POD.' }] },
  platform: { kicker: 'XDRIVE PLATFORM', title: 'One transport workflow. One operational record.', intro: 'Connect posted work, quotes, awards, dispatch, live progress, POD and finance readiness.', nav: 'Platform', cards: [{ title: 'Exchange workflow', copy: 'Post, quote, award and allocate transport work.' }, { title: 'Operational control', copy: 'Track progress through delivery and POD.' }] },
  brokers: { kicker: 'FOR TRANSPORT BROKERS', title: 'Post work. Compare quotes. Award with control.', intro: 'Manage customer transport work through one visible operational workflow.', nav: 'Brokers', cards: [{ title: 'Post transport work', copy: 'Create clear job requirements for the network.' }, { title: 'Compare & award', copy: 'Review quotes and award the right transport partner.' }] },
  customers: { kicker: 'FOR CUSTOMERS & SHIPPERS', title: 'Request transport with visibility from quote to POD.', intro: 'Keep transport requests, awarded work and delivery evidence connected.', cards: [{ title: 'Request transport', copy: 'Post work with the information carriers need.' }, { title: 'Follow completion', copy: 'Track awarded jobs through delivery evidence.' }] },
  couriers: { kicker: 'FOR COURIERS', title: 'Find work. Quote clearly. Deliver with proof.', intro: 'Use one workflow for opportunities, awarded jobs, live status and POD.', nav: 'Couriers', cards: [{ title: 'Find & quote', copy: 'Review available transport work and submit quotes.' }, { title: 'Run & complete', copy: 'Update job progress and finish with POD.' }] },
  drivers: { kicker: 'FOR DRIVERS', title: 'Your transport work, progress and proof in one place.', intro: 'Move from assigned work through pickup, delivery and POD with clear operational status.', cards: [{ title: 'Assigned work', copy: 'See the job information needed before collection.' }, { title: 'Live delivery flow', copy: 'Update status and complete delivery evidence.' }] },
  'owner-drivers': { kicker: 'FOR OWNER DRIVERS', title: 'Find work. Quote. Run your operation.', intro: 'Access transport opportunities and keep awarded work, POD and records connected.', cards: [{ title: 'Find opportunities', copy: 'Review suitable work across the exchange.' }, { title: 'Quote & deliver', copy: 'Win jobs and complete them through POD.' }] },
  carriers: { kicker: 'FOR CARRIERS', title: 'Capacity, dispatch and delivery records in one workflow.', intro: 'Coordinate transport work across drivers and vehicles without losing operational visibility.', cards: [{ title: 'Manage capacity', copy: 'Handle awarded work and driver allocation.' }, { title: 'Control completion', copy: 'Track jobs through POD and record readiness.' }] },
  'join-xdrive': { kicker: 'JOIN XDRIVE', title: 'Drivers, carriers, brokers and customers. One network.', intro: 'Choose the role that matches your operation and start with XDrive early access.', cards: [{ title: 'Choose your role', copy: 'Join as the transport participant that matches your work.' }, { title: 'Start 3 months free', copy: 'Eligible standard launch plans begin with free access.' }] },
  pricing: { kicker: 'XDRIVE MEMBERSHIP', title: 'Simple pricing. First 3 months free.', intro: 'No XDrive commission on job value. No XDrive booking fee. Monthly rolling after the free period.', nav: 'Pricing', cards: [{ title: 'Owner Driver · £29.99', copy: 'per month + VAT after the free period' }, { title: 'Broker · £79.99', copy: 'per month + VAT after the free period' }, { title: 'Small Carrier · £59.99', copy: 'per month + VAT after the free period' }] },
  access: { kicker: 'XDRIVE ACCESS', title: 'Start with controlled early access.', intro: 'Join the platform through the role and access route that matches your transport operation.', nav: 'Access', cards: [{ title: 'Apply', copy: 'Choose the correct role and submit your access request.' }, { title: 'Join', copy: 'Start using the platform once access is ready.' }] },
  finance: { kicker: 'FINANCE', title: 'From completed work to invoice readiness.', intro: 'Keep delivery completion, POD and finance records connected to the same operational flow.', cards: [{ title: 'Complete the job', copy: 'Delivery status and evidence remain linked.' }, { title: 'Prepare records', copy: 'Use completed work for invoice readiness.' }] },
  'pod-records': { kicker: 'POD & RECORDS', title: 'Delivery evidence connected to the job.', intro: 'Keep proof of delivery and operational history attached to the transport record.', cards: [{ title: 'Capture POD', copy: 'Complete delivery evidence against the job.' }, { title: 'Keep history', copy: 'Retain records for operational follow-up.' }] },
  'operations-diary': { kicker: 'OPERATIONS DIARY', title: 'Operational history without losing the thread.', intro: 'Keep transport activity, statuses and completion records visible across the workflow.', cards: [{ title: 'Track activity', copy: 'Follow operational events across each job.' }, { title: 'Keep the record', copy: 'Preserve the job history through completion.' }] },
  'courier-workspace': { kicker: 'COURIER WORKSPACE', title: 'Your active transport work in one operational view.', intro: 'Bring awarded jobs, statuses, POD and follow-up into one controlled workspace.', cards: [{ title: 'Manage active work', copy: 'Keep current jobs and operational status together.' }, { title: 'Complete cleanly', copy: 'Move finished jobs into POD and record readiness.' }] },
  'how-it-works': { kicker: 'HOW XDRIVE WORKS', title: 'Post. Quote. Award. Deliver. Record.', intro: 'A clear transport workflow from requirement to completed delivery evidence.', cards: [{ title: 'Post & quote', copy: 'Create the work and receive transport quotes.' }, { title: 'Award & complete', copy: 'Allocate, deliver and finish with POD.' }] },
  exchange: { kicker: 'XDRIVE EXCHANGE', title: 'Transport opportunities connected to execution.', intro: 'Bring posted work, courier quotes and awarded jobs into one controlled exchange workflow.', cards: [{ title: 'Available work', copy: 'See transport requirements ready for quoting.' }, { title: 'Awarded work', copy: 'Move successful quotes into operational execution.' }] },
};

export default async function Image({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const p = pages[page] || pages.platform;
  const cards = p.cards.slice(0, 3);

  return new ImageResponse(
    <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', background: '#F4F6FA', color: '#102447', fontFamily: 'Arial,sans-serif' }}>
      <div style={{ height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 58px', background: '#fff', borderBottom: '1px solid #DDE5EF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F5A300', color: '#102B55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', fontWeight: 900 }}>XD</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ fontSize: '24px', fontWeight: 900, color: '#163568' }}>XDrive Logistics</div><div style={{ fontSize: '13px', fontWeight: 700, color: '#60758F' }}>Courier & Freight Exchange Platform</div></div>
        </div>
        <div style={{ display: 'flex', gap: '22px', fontSize: '14px', fontWeight: 900, color: '#163568' }}><span style={{ color: p.nav === 'Platform' ? '#F5A300' : '#163568' }}>Platform</span><span style={{ color: p.nav === 'Brokers' ? '#F5A300' : '#163568' }}>Brokers</span><span style={{ color: p.nav === 'Couriers' ? '#F5A300' : '#163568' }}>Couriers</span><span style={{ color: p.nav === 'Pricing' ? '#F5A300' : '#163568' }}>Pricing</span><span style={{ color: p.nav === 'Access' ? '#F5A300' : '#163568' }}>Access</span></div>
      </div>

      <div style={{ height: '292px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 62px', background: 'linear-gradient(135deg,#163568 0%,#102B55 100%)', color: '#fff' }}>
        <div style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '0.16em', color: '#F5A300' }}>EARLY ACCESS · FIRST 3 MONTHS FREE</div>
        <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 900, letterSpacing: '0.15em', color: '#F5A300' }}>{p.kicker}</div>
        <div style={{ marginTop: '13px', maxWidth: '1060px', fontSize: p.title.length > 54 ? '46px' : '52px', lineHeight: 0.98, fontWeight: 900, letterSpacing: '-0.035em' }}>{p.title}</div>
        <div style={{ marginTop: '14px', maxWidth: '980px', fontSize: '17px', lineHeight: 1.35, fontWeight: 700, color: '#D8E4F3' }}>{p.intro}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '14px', padding: '24px 48px 28px', background: 'linear-gradient(180deg,#F8FAFD 0%,#EEF3F8 100%)' }}>
        {cards.map((card, index) => (
          <div key={card.title} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '190px', borderRadius: '18px', border: '1px solid #1B3D6B', background: 'linear-gradient(135deg,#163568 0%,#102B55 100%)', padding: '19px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', color: '#F5A300' }}>XDRIVE FLOW <span>0{index + 1}</span></div>
            <div style={{ marginTop: '15px', fontSize: '22px', lineHeight: 1.1, fontWeight: 900 }}>{card.title}</div>
            <div style={{ marginTop: '11px', fontSize: '14px', lineHeight: 1.4, fontWeight: 700, color: '#D8E4F3' }}>{card.copy}</div>
          </div>
        ))}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
