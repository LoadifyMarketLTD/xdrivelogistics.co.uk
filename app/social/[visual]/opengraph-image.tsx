import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'XDrive Logistics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const visuals: Record<string, { label: string; code: string; accent: string; motif: string }> = {
  platform: { label: 'Platform', code: 'PL', accent: '#F5A300', motif: 'POST · QUOTE · AWARD · POD' },
  broker: { label: 'Brokers', code: 'BR', accent: '#F5A300', motif: 'POST · COMPARE · AWARD' },
  customer: { label: 'Customers', code: 'CU', accent: '#67C7FF', motif: 'REQUEST · VISIBILITY · POD' },
  driver: { label: 'Drivers', code: 'DR', accent: '#7FE0B0', motif: 'ASSIGNED · LIVE · DELIVERED' },
  carrier: { label: 'Carriers', code: 'CA', accent: '#F7C85B', motif: 'CAPACITY · DISPATCH · POD' },
  'owner-driver': { label: 'Owner Drivers', code: 'OD', accent: '#FF9F5A', motif: 'FIND · QUOTE · RUN' },
  pricing: { label: 'Membership Pricing', code: '£', accent: '#F5A300', motif: '3 MONTHS FREE · MONTHLY ROLLING' },
  operations: { label: 'Operations', code: 'OP', accent: '#83AFFF', motif: 'ALLOCATE · TRACK · COMPLETE' },
  pod: { label: 'POD & Records', code: 'POD', accent: '#7FE0B0', motif: 'EVIDENCE · HISTORY · READY' },
  finance: { label: 'Finance', code: 'FN', accent: '#F7C85B', motif: 'COMPLETE · INVOICE · FOLLOW UP' },
  access: { label: 'Early Access', code: 'EA', accent: '#F5A300', motif: 'APPLY · REVIEW · JOIN' },
  network: { label: 'Join XDrive', code: 'NX', accent: '#67C7FF', motif: 'DRIVERS · CARRIERS · BROKERS · CUSTOMERS' },
};

export default async function Image({ params }: { params: Promise<{ visual: string }> }) {
  const { visual: key } = await params;
  const visual = visuals[key] || visuals.platform;
  return new ImageResponse(
    <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 70px', background: 'linear-gradient(135deg,#163568 0%,#102B55 68%,#0A234F 100%)', color: '#fff', fontFamily: 'Arial,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: '#F5A300', color: '#102B55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900 }}>XD</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ fontSize: '32px', fontWeight: 900 }}>XDrive Logistics</div><div style={{ marginTop: '5px', fontSize: '18px', color: '#D8E4F3' }}>Courier & Freight Exchange Platform</div></div>
        </div>
        <div style={{ fontSize: '17px', fontWeight: 900, color: '#F5A300' }}>XDRIVELOGISTICS.CO.UK</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '760px' }}><div style={{ fontSize: '19px', fontWeight: 900, color: visual.accent, letterSpacing: '0.1em' }}>{visual.label.toUpperCase()}</div><div style={{ marginTop: '18px', fontSize: '62px', lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.035em' }}>{visual.label === 'Membership Pricing' ? 'XDrive Membership Pricing' : `XDrive for ${visual.label}`}</div><div style={{ marginTop: '22px', fontSize: '20px', fontWeight: 800, color: '#D8E4F3' }}>{visual.motif}</div></div>
        <div style={{ width: '230px', height: '230px', borderRadius: '42px', border: `3px solid ${visual.accent}`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: visual.code.length > 2 ? '54px' : '78px', fontWeight: 900, color: visual.accent }}>{visual.code}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.18)', paddingTop: '22px', fontSize: '19px', fontWeight: 800, color: '#D8E4F3' }}><div>Move Freight. Manage Operations. Grow Your Network.</div><div>XDrive Logistics Ltd · UK</div></div>
    </div>,
    { width: 1200, height: 630 },
  );
}
