// Canonical design tokens for the Marketplace workspace.
// Every operational dashboard (Group B) must reference these constants.
// Derived directly from /app/admin/marketplace/page.tsx — the visual source of truth.

import type { CSSProperties } from 'react';

// ── Colours ──────────────────────────────────────────────────────────────────

export const WS_PAGE_BG       = '#F4F6F8';
export const WS_SURFACE       = '#FFFFFF';
export const WS_SURFACE_ALT   = '#F4F6F8';
export const WS_SURFACE_HEAD  = '#F4F6F8';

export const WS_BORDER        = 'rgba(11, 47, 107, 0.16)';
export const WS_BORDER_LIGHT  = 'rgba(11, 47, 107, 0.1)';
export const WS_BORDER_INPUT  = 'rgba(11, 47, 107, 0.2)';

export const WS_TEXT_PRIMARY  = '#1A1F2B';
export const WS_TEXT_BODY     = '#1A1F2B';
export const WS_TEXT_MUTED    = '#0B2F6B';
export const WS_TEXT_SUBTLE   = 'rgba(26, 31, 43, 0.68)';

export const WS_BLUE          = '#1D57D8';
export const WS_BLUE_BG       = 'rgba(29, 87, 216, 0.12)';

export const WS_GREEN         = '#1D57D8';
export const WS_GREEN_LIGHT   = 'rgba(29, 87, 216, 0.12)';
export const WS_GREEN_TEXT    = '#0B2F6B';

// ── Layout ────────────────────────────────────────────────────────────────────

export const WS_ASIDE_WIDTH   = '210px';
export const WS_HEADER_H      = '89px';      // Shared WorkspacePlatformShell desktop height
export const WS_CONTENT_PAD   = '0.85rem';

// ── Reusable style objects ────────────────────────────────────────────────────

/** Standard aside filter input */
export const wsInputStyle: CSSProperties = {
  width: '100%',
  padding: '0.38rem 0.5rem',
  border: `1px solid ${WS_BORDER}`,
  borderRadius: '4px',
  fontSize: '0.77rem',
  color: WS_TEXT_BODY,
  background: WS_SURFACE,
  marginBottom: '0.6rem',
  boxSizing: 'border-box',
};

/** Primary action button (green "Search" / "Submit") */
export const wsBtnPrimary: CSSProperties = {
  flex: 1,
  background: WS_GREEN,
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '5px',
  padding: '0.5rem',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'pointer',
};

/** Secondary / ghost button ("Clear" / "Cancel") */
export const wsBtnSecondary: CSSProperties = {
  padding: '0.5rem 0.65rem',
  border: `1px solid ${WS_BORDER}`,
  borderRadius: '5px',
  background: WS_SURFACE,
  cursor: 'pointer',
  fontSize: '0.78rem',
  color: WS_TEXT_MUTED,
};

/** Small header action button ("↻ Refresh") */
export const wsBtnAction: CSSProperties = {
  padding: '0.3rem 0.65rem',
  border: `1px solid ${WS_BORDER}`,
  borderRadius: '5px',
  background: WS_SURFACE,
  cursor: 'pointer',
  fontSize: '0.75rem',
  color: WS_TEXT_MUTED,
};
