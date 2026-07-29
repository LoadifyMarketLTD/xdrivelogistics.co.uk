import { describe, expect, it } from 'vitest';
import {
  ACTION_CENTRE_PRIORITY_COLORS,
  ACTION_CENTRE_PRIORITY_LABELS,
  ACTION_CENTRE_STATUS_COLORS,
  ACTION_CENTRE_STATUS_LABELS,
  workspaceTheme,
} from '../app/components/workspace/WorkspaceUI';
import type {
  ActionCentreItem,
  ActionCentreItemCta,
  ActionCentreItemPriority,
  ActionCentreItemStatus,
} from '../app/components/workspace/WorkspaceUI';

/**
 * Action Centre primitives contract tests.
 *
 * These tests verify exported type shapes and presentation lookup tables
 * without requiring a DOM or React rendering environment, consistent with
 * the project's existing pure-TypeScript test pattern.
 */

describe('ActionCentreItem type contract', () => {
  it('accepts a minimal item with required fields only', () => {
    const item: ActionCentreItem = {
      id: 'ac-001',
      title: 'Review pending shipment',
      priority: 'high',
      status: 'open',
    };
    expect(item.id).toBe('ac-001');
    expect(item.priority).toBe('high');
    expect(item.status).toBe('open');
    expect(item.description).toBeUndefined();
    expect(item.dueLabel).toBeUndefined();
    expect(item.entityLabel).toBeUndefined();
    expect(item.assigneeLabel).toBeUndefined();
    expect(item.cta).toBeUndefined();
  });

  it('accepts a fully populated item with all optional fields', () => {
    const cta: ActionCentreItemCta = { label: 'View job', href: '/jobs/123' };
    const item: ActionCentreItem = {
      id: 'ac-002',
      title: 'Overdue invoice requires approval',
      description: 'Invoice INV-88 is 5 days overdue.',
      priority: 'critical',
      status: 'in_progress',
      dueLabel: 'Overdue 5d',
      entityLabel: 'Invoice INV-88',
      assigneeLabel: 'J. Smith',
      cta,
    };
    expect(item.description).toBe('Invoice INV-88 is 5 days overdue.');
    expect(item.dueLabel).toBe('Overdue 5d');
    expect(item.entityLabel).toBe('Invoice INV-88');
    expect(item.assigneeLabel).toBe('J. Smith');
    expect(item.cta?.href).toBe('/jobs/123');
  });

  it('accepts an onClick CTA without href', () => {
    let called = false;
    const cta: ActionCentreItemCta = { label: 'Acknowledge', onClick: () => { called = true; } };
    const item: ActionCentreItem = { id: 'ac-003', title: 'Acknowledge alert', priority: 'medium', status: 'open', cta };
    item.cta?.onClick?.();
    expect(called).toBe(true);
    expect(item.cta?.href).toBeUndefined();
  });

  it('covers all four priority values', () => {
    const priorities: ActionCentreItemPriority[] = ['critical', 'high', 'medium', 'low'];
    expect(new Set(priorities).size).toBe(4);
    priorities.forEach((p) => {
      const item: ActionCentreItem = { id: p, title: p, priority: p, status: 'open' };
      expect(item.priority).toBe(p);
    });
  });

  it('covers all three status values', () => {
    const statuses: ActionCentreItemStatus[] = ['open', 'in_progress', 'resolved'];
    expect(new Set(statuses).size).toBe(3);
    statuses.forEach((s) => {
      const item: ActionCentreItem = { id: s, title: s, priority: 'low', status: s };
      expect(item.status).toBe(s);
    });
  });
});

describe('ACTION_CENTRE_PRIORITY_COLORS presentation mapping', () => {
  it('critical maps to red palette', () => {
    expect(ACTION_CENTRE_PRIORITY_COLORS.critical.color).toBe('#b91c1c');
    expect(ACTION_CENTRE_PRIORITY_COLORS.critical.bg).toBe('#fef2f2');
    expect(ACTION_CENTRE_PRIORITY_COLORS.critical.border).toBe('#fecaca');
  });

  it('high maps to amber/warning palette', () => {
    expect(ACTION_CENTRE_PRIORITY_COLORS.high.color).toBe('#92400e');
    expect(ACTION_CENTRE_PRIORITY_COLORS.high.bg).toBe('#fffbeb');
  });

  it('medium maps to blue palette', () => {
    expect(ACTION_CENTRE_PRIORITY_COLORS.medium.color).toBe('#1d4ed8');
    expect(ACTION_CENTRE_PRIORITY_COLORS.medium.bg).toBe('#eff6ff');
  });

  it('low maps to muted/grey palette', () => {
    expect(ACTION_CENTRE_PRIORITY_COLORS.low.color).toBe('#475569');
    expect(ACTION_CENTRE_PRIORITY_COLORS.low.bg).toBe('#f8fafc');
  });

  it('critical and low are visually distinct (different colours)', () => {
    expect(ACTION_CENTRE_PRIORITY_COLORS.critical.color).not.toBe(ACTION_CENTRE_PRIORITY_COLORS.low.color);
  });

  it('critical does not use green (would imply positive)', () => {
    expect(ACTION_CENTRE_PRIORITY_COLORS.critical.color).not.toBe(workspaceTheme.green);
    expect(ACTION_CENTRE_PRIORITY_COLORS.critical.bg).not.toBe('#f0fdf4');
  });

  it('all four priorities have a complete palette entry', () => {
    const priorities: ActionCentreItemPriority[] = ['critical', 'high', 'medium', 'low'];
    priorities.forEach((p) => {
      const palette = ACTION_CENTRE_PRIORITY_COLORS[p];
      expect(typeof palette.bg).toBe('string');
      expect(typeof palette.color).toBe('string');
      expect(typeof palette.border).toBe('string');
    });
  });
});

describe('ACTION_CENTRE_STATUS_COLORS presentation mapping', () => {
  it('open maps to amber/warning palette (requires attention)', () => {
    expect(ACTION_CENTRE_STATUS_COLORS.open.color).toBe('#92400e');
    expect(ACTION_CENTRE_STATUS_COLORS.open.bg).toBe('#fffbeb');
  });

  it('in_progress maps to blue palette (active work)', () => {
    expect(ACTION_CENTRE_STATUS_COLORS.in_progress.color).toBe('#1d4ed8');
    expect(ACTION_CENTRE_STATUS_COLORS.in_progress.bg).toBe('#eff6ff');
  });

  it('resolved maps to green palette (complete)', () => {
    expect(ACTION_CENTRE_STATUS_COLORS.resolved.color).toBe('#166534');
    expect(ACTION_CENTRE_STATUS_COLORS.resolved.bg).toBe('#f0fdf4');
  });

  it('open and resolved are visually distinct', () => {
    expect(ACTION_CENTRE_STATUS_COLORS.open.color).not.toBe(ACTION_CENTRE_STATUS_COLORS.resolved.color);
  });

  it('all three statuses have a complete palette entry', () => {
    const statuses: ActionCentreItemStatus[] = ['open', 'in_progress', 'resolved'];
    statuses.forEach((s) => {
      const palette = ACTION_CENTRE_STATUS_COLORS[s];
      expect(typeof palette.bg).toBe('string');
      expect(typeof palette.color).toBe('string');
      expect(typeof palette.border).toBe('string');
    });
  });
});

describe('ACTION_CENTRE_PRIORITY_LABELS', () => {
  it('maps all four priorities to human-readable strings', () => {
    expect(ACTION_CENTRE_PRIORITY_LABELS.critical).toBe('Critical');
    expect(ACTION_CENTRE_PRIORITY_LABELS.high).toBe('High');
    expect(ACTION_CENTRE_PRIORITY_LABELS.medium).toBe('Medium');
    expect(ACTION_CENTRE_PRIORITY_LABELS.low).toBe('Low');
  });
});

describe('ACTION_CENTRE_STATUS_LABELS', () => {
  it('maps all three statuses to human-readable strings', () => {
    expect(ACTION_CENTRE_STATUS_LABELS.open).toBe('Open');
    expect(ACTION_CENTRE_STATUS_LABELS.in_progress).toBe('In Progress');
    expect(ACTION_CENTRE_STATUS_LABELS.resolved).toBe('Resolved');
  });
});
