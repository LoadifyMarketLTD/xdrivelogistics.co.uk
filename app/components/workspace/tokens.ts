// Canonical design tokens for the Marketplace workspace.
// Every operational dashboard (Group B) must reference these constants.
// Derived directly from /app/admin/marketplace/page.tsx — the visual source of truth.

import type { CSSProperties } from 'react';

// ── Colours ──────────────────────────────────────────────────────────────────

export const WS_PAGE_BG       = '#f5f7fa';   // page canvas
export const WS_SURFACE       = '#ffffff';   // card / panel background
export const WS_SURFACE_ALT   = '#fafbfc';   // card footers
export const WS_SURFACE_HEAD  = '#f8fafc';   // table <thead> background

export const WS_BORDER        = '#e2e8f0';   // standard border
export const WS_BORDER_LIGHT  = '#f1f5f9';   // light row dividers
export const WS_BORDER_INPUT  = '#d1d5db';   // input / modal-button border

export const WS_TEXT_PRIMARY  = '#0f172a';   // headings, key values
export const WS_TEXT_BODY     = '#374151';   // body copy, cell text
export const WS_TEXT_MUTED    = '#64748b';   // muted / meta text
export const WS_TEXT_SUBTLE   = '#94a3b8';   // labels, placeholders

export const WS_BLUE          = '#1d4ed8';   // active tab, primary action tint
export const WS_BLUE_BG       = '#dbeafe';   // active tab count chip background

export const WS_GREEN         = '#16a34a';   // primary CTA buttons
export const WS_GREEN_LIGHT   = '#dcfce7';   // awarded / success badge bg
export const WS_GREEN_TEXT    = '#15803d';   // awarded / success badge text

// ── Layout ────────────────────────────────────────────────────────────────────

export const WS_ASIDE_WIDTH   = '210px';
export const WS_HEADER_H      = '89px';      // AdminPlatformShell nav bar height
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
  color: '#fff',
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
