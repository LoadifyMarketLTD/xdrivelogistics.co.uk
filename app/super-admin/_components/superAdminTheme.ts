import type { CSSProperties } from 'react';

export const SUPER_ADMIN_THEME = {
  pageBg: '#f5f7fa',
  shellBg: '#ffffff',
  shellBorder: '#e2e8f0',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  cardShadow: 'none',
  text: '#0f172a',
  muted: '#475569',
  subtle: '#64748b',
  primary: '#1d4ed8',
  primarySoft: '#dbeafe',
  primarySurface: '#eff6ff',
  success: '#15803d',
  warning: '#c2410c',
  danger: '#b91c1c',
  radius: '8px',
} as const;

export const superAdminCardStyle: CSSProperties = {
  backgroundColor: SUPER_ADMIN_THEME.cardBg,
  border: `1px solid ${SUPER_ADMIN_THEME.cardBorder}`,
  borderRadius: SUPER_ADMIN_THEME.radius,
  boxShadow: SUPER_ADMIN_THEME.cardShadow,
};
