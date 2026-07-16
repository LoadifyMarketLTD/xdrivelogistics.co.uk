import type { CSSProperties } from 'react';

export const SUPER_ADMIN_THEME = {
  pageBg: '#eef2f6',
  shellBg: '#f8fafc',
  shellBorder: '#d7e0ea',
  cardBg: '#ffffff',
  cardBorder: '#d7e0ea',
  cardShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
  text: '#0f172a',
  muted: '#475569',
  subtle: '#64748b',
  primary: '#1d4ed8',
  primarySoft: '#dbeafe',
  primarySurface: '#eff6ff',
  success: '#15803d',
  warning: '#c2410c',
  danger: '#b91c1c',
  radius: '10px',
} as const;

export const superAdminCardStyle: CSSProperties = {
  backgroundColor: SUPER_ADMIN_THEME.cardBg,
  border: `1px solid ${SUPER_ADMIN_THEME.cardBorder}`,
  borderRadius: SUPER_ADMIN_THEME.radius,
  boxShadow: SUPER_ADMIN_THEME.cardShadow,
};
