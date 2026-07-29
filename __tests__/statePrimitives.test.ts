import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ErrorState,
  LOADING_STATE_DEFAULT_ROWS,
  LoadingState,
  PermissionDeniedState,
} from '../app/components/workspace/WorkspaceUI';

/**
 * Standardized state primitives — rendered-output assertions.
 *
 * All tests render the real exported components via `renderToStaticMarkup`
 * (Node-safe, no jsdom required). No data fetching, auth session, role,
 * company or Supabase logic is present in any of the tested primitives.
 */

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------

describe('LoadingState — role="status" and accessible label', () => {
  it('renders role="status" region', () => {
    const html = render(React.createElement(LoadingState, {}));
    expect(html).toContain('role="status"');
  });

  it('renders default label "Loading…" in aria-label and visible text', () => {
    const html = render(React.createElement(LoadingState, {}));
    expect(html).toContain('Loading\u2026');
  });

  it('renders a custom label when supplied', () => {
    const html = render(React.createElement(LoadingState, { label: 'Loading shipments\u2026' }));
    expect(html).toContain('Loading shipments\u2026');
    expect(html).toContain('aria-label="Loading shipments\u2026"');
  });

  it('does not render the default label when a custom label is supplied', () => {
    const html = render(React.createElement(LoadingState, { label: 'Please wait' }));
    expect(html).not.toContain('Loading\u2026');
    expect(html).toContain('Please wait');
  });
});

describe('LoadingState — skeleton bars', () => {
  it('renders LOADING_STATE_DEFAULT_ROWS skeleton bars when rows is omitted', () => {
    const html = render(React.createElement(LoadingState, {}));
    const matches = (html.match(/xdrive-skeleton-bar/g) ?? []).length;
    expect(matches).toBe(LOADING_STATE_DEFAULT_ROWS);
  });

  it('renders the supplied number of skeleton bars', () => {
    const html = render(React.createElement(LoadingState, { rows: 5 }));
    const matches = (html.match(/xdrive-skeleton-bar/g) ?? []).length;
    expect(matches).toBe(5);
  });

  it('renders at least 1 skeleton bar even when rows=0 is supplied', () => {
    const html = render(React.createElement(LoadingState, { rows: 0 }));
    const matches = (html.match(/xdrive-skeleton-bar/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it('skeleton bars are aria-hidden', () => {
    const html = render(React.createElement(LoadingState, {}));
    const hiddenCount = (html.match(/aria-hidden="true"/g) ?? []).length;
    // spinner + each skeleton bar
    expect(hiddenCount).toBeGreaterThanOrEqual(LOADING_STATE_DEFAULT_ROWS);
  });

  it('renders spinner element with xdrive-loading-spinner class', () => {
    const html = render(React.createElement(LoadingState, {}));
    expect(html).toContain('xdrive-loading-spinner');
  });
});

describe('LoadingState — container class', () => {
  it('renders xdrive-loading-state container class', () => {
    const html = render(React.createElement(LoadingState, {}));
    expect(html).toContain('xdrive-loading-state');
  });
});

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

describe('ErrorState — role="alert" and message', () => {
  it('renders role="alert" region', () => {
    const html = render(React.createElement(ErrorState, { message: 'Network error' }));
    expect(html).toContain('role="alert"');
  });

  it('renders the supplied error message verbatim', () => {
    const html = render(React.createElement(ErrorState, { message: 'Failed to load shipments.' }));
    expect(html).toContain('Failed to load shipments.');
  });

  it('renders a heading "Something went wrong"', () => {
    const html = render(React.createElement(ErrorState, { message: 'Any error' }));
    expect(html).toContain('Something went wrong');
  });

  it('renders xdrive-error-state container class', () => {
    const html = render(React.createElement(ErrorState, { message: 'Any error' }));
    expect(html).toContain('xdrive-error-state');
  });
});

describe('ErrorState — optional retry button', () => {
  it('does not render a retry button when onRetry is omitted', () => {
    const html = render(React.createElement(ErrorState, { message: 'err' }));
    expect(html).not.toContain('Retry');
  });

  it('renders a retry button when onRetry is supplied', () => {
    const onRetry = vi.fn();
    const html = render(React.createElement(ErrorState, { message: 'err', onRetry }));
    expect(html).toContain('Retry');
    expect(html).toContain('<button');
  });

  it('retry button has type="button"', () => {
    const html = render(React.createElement(ErrorState, { message: 'err', onRetry: vi.fn() }));
    expect(html).toContain('type="button"');
  });
});

// ---------------------------------------------------------------------------
// PermissionDeniedState
// ---------------------------------------------------------------------------

describe('PermissionDeniedState — role="alert" and heading', () => {
  it('renders role="alert" region', () => {
    const html = render(React.createElement(PermissionDeniedState, {}));
    expect(html).toContain('role="alert"');
  });

  it('renders "Access restricted" heading', () => {
    const html = render(React.createElement(PermissionDeniedState, {}));
    expect(html).toContain('Access restricted');
  });

  it('renders xdrive-permission-denied-state container class', () => {
    const html = render(React.createElement(PermissionDeniedState, {}));
    expect(html).toContain('xdrive-permission-denied-state');
  });
});

describe('PermissionDeniedState — reason text', () => {
  it('renders a default reason when none is supplied', () => {
    const html = render(React.createElement(PermissionDeniedState, {}));
    expect(html).toContain('You do not have permission to view this content.');
  });

  it('renders the supplied reason verbatim', () => {
    const html = render(React.createElement(PermissionDeniedState, { reason: 'Driver workspace only.' }));
    expect(html).toContain('Driver workspace only.');
  });

  it('does not render the default reason when a custom reason is supplied', () => {
    const html = render(React.createElement(PermissionDeniedState, { reason: 'Custom reason.' }));
    expect(html).not.toContain('You do not have permission to view this content.');
  });
});

describe('PermissionDeniedState — optional action', () => {
  it('does not render any action when action is omitted', () => {
    const html = render(React.createElement(PermissionDeniedState, {}));
    // No button or link beyond the icon
    expect(html).not.toContain('Request Access');
  });

  it('renders the supplied action element', () => {
    const action = React.createElement('a', { href: '/request-access' }, 'Request Access');
    const html = render(React.createElement(PermissionDeniedState, { action }));
    expect(html).toContain('Request Access');
    expect(html).toContain('href="/request-access"');
  });
});

describe('PermissionDeniedState — no permission inference', () => {
  it('does not contain any role/company/session field names in its output', () => {
    const html = render(React.createElement(PermissionDeniedState, {}));
    // None of these data fields must appear — presentation only
    expect(html).not.toContain('companyId');
    expect(html).not.toContain('userId');
    expect(html).not.toContain('workspaceRole');
    expect(html).not.toContain('supabase');
  });
});
