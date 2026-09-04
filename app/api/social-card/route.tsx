import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import type { MarketingSocialVisual } from '../../../lib/marketingMetadata';

export const runtime = 'edge';

const clamp = (value: string | null, fallback: string, max: number) => {
  const clean = (value || fallback).trim().replace(/\s+/g, ' ');
  return clean.slice(0, max);
};

const visuals: Record<MarketingSocialVisual, { label: string; code: string; accent: string; motif: string }> = {
  platform: { label: 'Platform', code: 'PL', accent: '#F5A300', motif: 'POST → QUOTE → AWARD → POD' },
  broker: { label: 'Brokers', code: 'BR', accent: '#F5A300', motif: 'POST · COMPARE · AWARD' },
  customer: { label: 'Customers', code: 'CU', accent: '#67C7FF', motif: 'REQUEST · VISIBILITY · POD' },
  driver: { label: 'Drivers', code: 'DR', accent: '#7FE0B0', motif: 'ASSIGNED · LIVE · DELIVERED' },
  carrier: { label: 'Carriers', code: 'CA', accent: '#F7C85B', motif: 'CAPACITY · DISPATCH · POD' },
  'owner-driver': { label: 'Owner Drivers', code: 'OD', accent: '#FF9F5A', motif: 'FIND · QUOTE · RUN' },
  pricing: { label: 'Membership', code: '£', accent: '#F5A300', motif: '3 MONTHS FREE · MONTHLY ROLLING' },
  operations: { label: 'Operations', code: 'OP', accent: '#83AFFF', motif: 'ALLOCATE · TRACK · COMPLETE' },
  pod: { label: 'POD & Records', code: 'POD', accent: '#7FE0B0', motif: 'EVIDENCE · HISTORY · READY' },
  finance: { label: 'Finance', code: 'FN', accent: '#F7C85B', motif: 'COMPLETE · INVOICE · FOLLOW UP' },
  access: { label: 'Early Access', code: 'EA', accent: '#F5A300', motif: 'APPLY · REVIEW · JOIN' },
  network: { label: 'Join XDrive', code: 'NX', accent: '#67C7FF', motif: 'DRIVERS · CARRIERS · BROKERS · CUSTOMERS' },
};

const isVisual = (value: string | null): value is MarketingSocialVisual => Boolean(value && value in visuals);

export async function GET(request: NextRequest) {
  const title = clamp(
    request.nextUrl.searchParams.get('title'),
    'Move Freight. Manage Operations. Grow Your Network.',
    120,
  );
  const kicker = clamp(request.nextUrl.searchParams.get('kicker'), 'XDrive Logistics', 56);
  const requestedVisual = request.nextUrl.searchParams.get('visual');
  const visual = visuals[isVisual(requestedVisual) ? requestedVisual : 'platform'];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '58px 66px',
          background: 'linear-gradient(135deg, #163568 0%, #102B55 68%, #0A234F 100%)',
          color: '#FFFFFF',
          fontFamily: 'Arial, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: '-55px', top: '120px', width: '390px', height: '390px', borderRadius: '999px', border: `34px solid ${visual.accent}`, opacity: 0.12 }} />
        <div style={{ position: 'absolute', right: '68px', top: '182px', width: '235px', height: '235px', borderRadius: '42px', border: `2px solid ${visual.accent}`, background: 'rgba(255,255,255,0.035)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: visual.code.length > 2 ? '54px' : '74px', fontWeight: 900, color: visual.accent, letterSpacing: '-0.04em' }}>{visual.code}</div>
        </div>
        <div style={{ position: 'absolute', right: '74px', top: '435px', width: '300px', display: 'flex', justifyContent: 'center', fontSize: '15px', fontWeight: 900, color: '#D8E4F3', letterSpacing: '0.08em' }}>{visual.motif}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '19px', background: '#F5A300', color: '#102B55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '27px', fontWeight: 900 }}>XD</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '29px', fontWeight: 900 }}>XDrive Logistics</div>
              <div style={{ marginTop: '4px', fontSize: '17px', fontWeight: 700, color: '#D8E4F3' }}>Courier & Freight Exchange Platform</div>
            </div>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: '#F5A300', letterSpacing: '0.08em' }}>XDRIVELOGISTICS.CO.UK</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '760px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '5px', borderRadius: '999px', background: visual.accent }} />
            <div style={{ fontSize: '18px', fontWeight: 900, color: visual.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{kicker}</div>
          </div>
          <div style={{ marginTop: '20px', fontSize: title.length > 74 ? '49px' : '58px', lineHeight: 1.04, fontWeight: 900, letterSpacing: '-0.035em' }}>{title}</div>
          <div style={{ marginTop: '20px', display: 'flex', width: 'fit-content', borderRadius: '999px', border: `1px solid ${visual.accent}`, padding: '9px 15px', fontSize: '14px', fontWeight: 900, color: visual.accent }}>{visual.label.toUpperCase()}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.16)', paddingTop: '22px', position: 'relative' }}>
          <div style={{ fontSize: '19px', fontWeight: 800, color: '#D8E4F3' }}>Move Freight. Manage Operations. <span style={{ color: '#F5A300' }}>Grow Your Network.</span></div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#D8E4F3' }}>XDrive Logistics Ltd · UK</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      },
    },
  );
}
