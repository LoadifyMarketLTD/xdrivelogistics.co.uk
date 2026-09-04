import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const clamp = (value: string | null, fallback: string, max: number) => {
  const clean = (value || fallback).trim().replace(/\s+/g, ' ');
  return clean.slice(0, max);
};

export async function GET(request: NextRequest) {
  const title = clamp(
    request.nextUrl.searchParams.get('title'),
    'Move Freight. Manage Operations. Grow Your Network.',
    120,
  );
  const kicker = clamp(request.nextUrl.searchParams.get('kicker'), 'XDrive Logistics', 56);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #163568 0%, #102B55 72%, #0A234F 100%)',
          color: '#FFFFFF',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '20px',
                background: '#F5A300',
                color: '#102B55',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 900,
              }}
            >
              XD
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '30px', fontWeight: 900 }}>XDrive Logistics</div>
              <div style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: '#D8E4F3' }}>
                Courier & Freight Exchange Platform
              </div>
            </div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#F5A300', letterSpacing: '0.08em' }}>
            XDRIVELOGISTICS.CO.UK
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '1030px' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#F5A300', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {kicker}
          </div>
          <div style={{ marginTop: '20px', fontSize: title.length > 74 ? '52px' : '62px', lineHeight: 1.04, fontWeight: 900, letterSpacing: '-0.035em' }}>
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.16)', paddingTop: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#D8E4F3' }}>
            Move Freight. Manage Operations. <span style={{ color: '#F5A300' }}>Grow Your Network.</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#D8E4F3' }}>XDrive Logistics Ltd · UK</div>
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
