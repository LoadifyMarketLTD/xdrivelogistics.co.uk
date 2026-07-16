'use client';

import { MobileCard, mobileMutedTextStyle } from './MobileUiPrimitives';

export default function MobileWebDeprecationNotice() {
  return (
    <MobileCard style={{ marginBottom: '0.75rem', borderColor: 'rgba(245, 163, 0, 0.45)' }}>
      <div style={{ color: '#F5A300', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.06em' }}>DEPRECATION NOTICE</div>
      <div style={{ marginTop: '0.4rem', fontSize: '0.95rem', fontWeight: 850, color: '#F4F6F8' }}>
        Legacy <code style={{ fontSize: '0.82rem' }}>/m</code> web routes are being phased out.
      </div>
      <div style={{ ...mobileMutedTextStyle, marginTop: '0.4rem', lineHeight: 1.45 }}>
        Use the native Expo app in <code style={{ fontSize: '0.76rem' }}>apps/driver-mobile</code> for driver mobile operations.
      </div>
    </MobileCard>
  );
}
