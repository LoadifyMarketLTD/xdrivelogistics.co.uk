import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ErrorState,
  LOADING_STATE_DEFAULT_ROWS,
  LoadingState,
  PermissionDeniedState,
  WorkspaceState,
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

// ---------------------------------------------------------------------------
// WorkspaceState — discriminated union primitive
// ---------------------------------------------------------------------------

describe('WorkspaceState — loading variant', () => {
  it('renders role="status" for loading variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'loading' }));
    expect(html).toContain('role="status"');
  });

  it('renders default loading label for loading variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'loading' }));
    expect(html).toContain('Loading\u2026');
  });

  it('renders custom label when supplied for loading variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'loading', label: 'Loading jobs\u2026' }));
    expect(html).toContain('Loading jobs\u2026');
    expect(html).toContain('aria-label="Loading jobs\u2026"');
  });

  it('loading variant does not render role="alert"', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'loading' }));
    expect(html).not.toContain('role="alert"');
  });

  it('renders custom skeleton row count for loading variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'loading', rows: 5 }));
    const matches = (html.match(/xdrive-skeleton-bar/g) ?? []).length;
    expect(matches).toBe(5);
  });
});

describe('WorkspaceState — empty variant', () => {
  it('renders caller-supplied title verbatim', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'empty', title: 'No shipments yet' }));
    expect(html).toContain('No shipments yet');
  });

  it('renders caller-supplied description verbatim', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'empty', title: 'T', description: 'Create your first shipment to get started.' }));
    expect(html).toContain('Create your first shipment to get started.');
  });

  it('uses default title "No records found" when title is omitted', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'empty' }));
    expect(html).toContain('No records found');
  });

  it('renders supplied action for empty variant', () => {
    const action = React.createElement('a', { href: '/new' }, 'Add shipment');
    const html = render(React.createElement(WorkspaceState, { variant: 'empty', title: 'T', action }));
    expect(html).toContain('Add shipment');
    expect(html).toContain('href="/new"');
  });

  it('renders custom icon for empty variant instead of default', () => {
    const icon = React.createElement('span', { 'data-testid': 'custom-icon' }, '\u{1F4E6}');
    const html = render(React.createElement(WorkspaceState, { variant: 'empty', title: 'T', icon }));
    expect(html).toContain('data-testid="custom-icon"');
  });

  it('empty variant does not render role="alert" or role="status"', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'empty', title: 'T' }));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });
});

describe('WorkspaceState — error variant', () => {
  it('renders role="alert" for error variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'Network failure.' }));
    expect(html).toContain('role="alert"');
  });

  it('renders caller-supplied error message verbatim', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'Failed to load jobs.' }));
    expect(html).toContain('Failed to load jobs.');
  });

  it('does not render retry button when onRetry is omitted', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'err' }));
    expect(html).not.toContain('Retry');
  });

  it('renders retry button when onRetry is supplied', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'err', onRetry: vi.fn() }));
    expect(html).toContain('Retry');
    expect(html).toContain('type="button"');
  });

  it('renders custom icon for error variant instead of default', () => {
    const icon = React.createElement('span', { 'data-testid': 'err-icon' }, 'X');
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'err', icon }));
    expect(html).toContain('data-testid="err-icon"');
  });

  it('error variant does not contain permission/session field names', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'err' }));
    expect(html).not.toContain('companyId');
    expect(html).not.toContain('userId');
    expect(html).not.toContain('workspaceRole');
  });
});

describe('WorkspaceState — permission variant', () => {
  it('renders role="alert" for permission variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'permission' }));
    expect(html).toContain('role="alert"');
  });

  it('renders "Access restricted" heading for permission variant', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'permission' }));
    expect(html).toContain('Access restricted');
  });

  it('renders default reason text when reason is omitted', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'permission' }));
    expect(html).toContain('You do not have permission to view this content.');
  });

  it('renders caller-supplied reason verbatim', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'permission', reason: 'Fleet admin access required.' }));
    expect(html).toContain('Fleet admin access required.');
  });

  it('does not render action when action is omitted', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'permission' }));
    expect(html).not.toContain('Request Access');
  });

  it('renders supplied action for permission variant', () => {
    const action = React.createElement('a', { href: '/request' }, 'Request Access');
    const html = render(React.createElement(WorkspaceState, { variant: 'permission', action }));
    expect(html).toContain('Request Access');
    expect(html).toContain('href="/request"');
  });

  it('renders custom icon for permission variant instead of default', () => {
    const icon = React.createElement('span', { 'data-testid': 'lock-icon' }, '\uD83D\uDD12');
    const html = render(React.createElement(WorkspaceState, { variant: 'permission', icon }));
    expect(html).toContain('data-testid="lock-icon"');
  });

  it('permission variant does not contain permission/session field names', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'permission' }));
    expect(html).not.toContain('companyId');
    expect(html).not.toContain('userId');
    expect(html).not.toContain('workspaceRole');
    expect(html).not.toContain('supabase');
  });
});

describe('WorkspaceState — variant controls semantics independently of text', () => {
  it('permission variant with message text renders alert, not status', () => {
    // variant controls ARIA role, not the props content
    const html = render(React.createElement(WorkspaceState, { variant: 'permission', reason: 'Loading data unavailable.' }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it('error variant with permission-sounding message renders alert', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'error', message: 'Access denied.' }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it('loading variant never renders role="alert" regardless of label', () => {
    const html = render(React.createElement(WorkspaceState, { variant: 'loading', label: 'Error loading data' }));
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });
});
