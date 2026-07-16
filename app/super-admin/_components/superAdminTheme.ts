import type { CSSProperties } from 'react';

export const SUPER_ADMIN_THEME = {
  pageBg: '#F4F6F8',
  shellBg: '#FFFFFF',
  shellBorder: 'rgba(11, 47, 107, 0.16)',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(11, 47, 107, 0.16)',
  cardShadow: 'none',
  text: '#1A1F2B',
  muted: '#0B2F6B',
  subtle: 'rgba(26, 31, 43, 0.68)',
  primary: '#1D57D8',
  primarySoft: 'rgba(29, 87, 216, 0.12)',
  primarySurface: '#F4F6F8',
  success: '#1D57D8',
  warning: '#F5A300',
  danger: '#F5A300',
  radius: '8px',
} as const;

export const superAdminCardStyle: CSSProperties = {
  backgroundColor: SUPER_ADMIN_THEME.cardBg,
  border: `1px solid ${SUPER_ADMIN_THEME.cardBorder}`,
  borderRadius: SUPER_ADMIN_THEME.radius,
  boxShadow: SUPER_ADMIN_THEME.cardShadow,
};
