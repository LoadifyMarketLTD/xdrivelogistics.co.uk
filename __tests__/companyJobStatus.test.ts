import { describe, expect, it } from 'vitest';
import {
  getStatusLabel,
  getStatusTone,
  getPermittedActions,
  isTerminalStatus,
  isActiveStatus,
  STATUS_REGISTRY,
} from '../lib/companyJobStatus';

// ── getStatusLabel ────────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it('returns company label for canonical key "draft"', () => {
    expect(getStatusLabel('draft')).toBe('Draft / Received');
  });

  it('resolves alias "received" to the draft entry label', () => {
    // 'received' is an alias for 'draft'
    expect(getStatusLabel('received')).toBe('Draft / Received');
  });

  it('returns company label for "posted"', () => {
    expect(getStatusLabel('posted')).toBe('Posted to Exchange');
  });

  it('resolves alias "open" to posted label', () => {
    expect(getStatusLabel('open')).toBe('Posted to Exchange');
  });

  it('resolves alias "live" to posted label', () => {
    expect(getStatusLabel('live')).toBe('Posted to Exchange');
  });

  it('returns company label for "allocated"', () => {
    expect(getStatusLabel('allocated')).toBe('Driver Allocated');
  });

  it('returns "Delivered" for canonical key "delivered"', () => {
    expect(getStatusLabel('delivered')).toBe('Delivered');
  });

  it('resolves alias "complete" to delivered label', () => {
    expect(getStatusLabel('complete')).toBe('Delivered');
  });

  it('resolves alias "completed" to delivered label', () => {
    expect(getStatusLabel('completed')).toBe('Delivered');
  });

  it('returns "Cancelled" for canonical key "cancelled"', () => {
    expect(getStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('title-cases unknown status without underscores', () => {
    const result = getStatusLabel('some_unknown_status');
    expect(result).not.toContain('_');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles null without throwing', () => {
    expect(() => getStatusLabel(null)).not.toThrow();
    expect(getStatusLabel(null)).toBe('Unknown');
  });

  it('handles undefined without throwing', () => {
    expect(() => getStatusLabel(undefined)).not.toThrow();
  });

  it('handles object without throwing', () => {
    expect(() => getStatusLabel({ bad: true })).not.toThrow();
  });
});

// ── getStatusTone ─────────────────────────────────────────────────────────────

describe('getStatusTone', () => {
  it('returns "grey" for draft (and its alias received)', () => {
    expect(getStatusTone('draft')).toBe('grey');
    expect(getStatusTone('received')).toBe('grey');
  });

  it('returns "blue" for posted statuses', () => {
    expect(getStatusTone('posted')).toBe('blue');
  });

  it('returns "orange" for quoted', () => {
    expect(getStatusTone('quoted')).toBe('orange');
  });

  it('returns "purple" for awarded', () => {
    expect(getStatusTone('awarded')).toBe('purple');
  });

  it('returns "green" for delivered', () => {
    expect(getStatusTone('delivered')).toBe('green');
  });

  it('returns "red" for cancelled', () => {
    expect(getStatusTone('cancelled')).toBe('red');
  });

  it('returns "red" for disputed', () => {
    expect(getStatusTone('disputed')).toBe('red');
  });

  it('returns "grey" for unknown status', () => {
    expect(getStatusTone('nonexistent_status')).toBe('grey');
  });

  it('returns "grey" for null', () => {
    expect(getStatusTone(null)).toBe('grey');
  });
});

// ── getPermittedActions ───────────────────────────────────────────────────────

describe('getPermittedActions', () => {
  it('returns at least "view" for every registry entry', () => {
    for (const entry of STATUS_REGISTRY) {
      const actions = getPermittedActions(entry.key);
      expect(actions).toContain('view');
    }
  });

  it('allows post_to_exchange from draft', () => {
    expect(getPermittedActions('draft')).toContain('post_to_exchange');
  });

  it('allows post_to_exchange via alias "received"', () => {
    // 'received' is alias for 'draft'
    expect(getPermittedActions('received')).toContain('post_to_exchange');
  });

  it('allows withdraw_from_exchange from posted', () => {
    expect(getPermittedActions('posted')).toContain('withdraw_from_exchange');
  });

  it('does not allow post_to_exchange from delivered', () => {
    expect(getPermittedActions('delivered')).not.toContain('post_to_exchange');
  });

  it('returns only ["view"] for cancelled (terminal, exception)', () => {
    const actions = getPermittedActions('cancelled');
    expect(actions).toContain('view');
    expect(actions).not.toContain('post_to_exchange');
    expect(actions).not.toContain('award');
  });

  it('falls back to ["view"] for unknown status', () => {
    expect(getPermittedActions('totally_unknown')).toEqual(['view']);
  });

  it('falls back to ["view"] for null', () => {
    expect(getPermittedActions(null)).toEqual(['view']);
  });

  it('returns an array of strings', () => {
    const actions = getPermittedActions('draft');
    expect(Array.isArray(actions)).toBe(true);
    for (const a of actions) {
      expect(typeof a).toBe('string');
    }
  });
});

// ── isTerminalStatus ──────────────────────────────────────────────────────────

describe('isTerminalStatus', () => {
  it('returns true for "cancelled"', () => {
    expect(isTerminalStatus('cancelled')).toBe(true);
  });

  it('returns true for "paid"', () => {
    expect(isTerminalStatus('paid')).toBe(true);
  });

  it('returns false for "delivered" (non-terminal; invoicing expected)', () => {
    // delivered is workflowGroup: 'complete' but terminal: false
    expect(isTerminalStatus('delivered')).toBe(false);
  });

  it('returns false for "invoiced" (still needs payment)', () => {
    expect(isTerminalStatus('invoiced')).toBe(false);
  });

  it('returns false for active states', () => {
    expect(isTerminalStatus('draft')).toBe(false);
    expect(isTerminalStatus('posted')).toBe(false);
    expect(isTerminalStatus('allocated')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isTerminalStatus('nonexistent')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTerminalStatus(null)).toBe(false);
  });
});

// ── isActiveStatus ────────────────────────────────────────────────────────────

describe('isActiveStatus', () => {
  it('returns true for "allocated" (operational group)', () => {
    expect(isActiveStatus('allocated')).toBe(true);
  });

  it('returns true for "collected" (operational group)', () => {
    expect(isActiveStatus('collected')).toBe(true);
  });

  it('returns true for "in_transit" (operational group)', () => {
    expect(isActiveStatus('in_transit')).toBe(true);
  });

  it('returns true for "awarded" (awarded group)', () => {
    expect(isActiveStatus('awarded')).toBe(true);
  });

  it('returns false for "draft" (pre_market group)', () => {
    expect(isActiveStatus('draft')).toBe(false);
  });

  it('returns false for "posted" (market group)', () => {
    expect(isActiveStatus('posted')).toBe(false);
  });

  it('returns false for "cancelled" (exception, terminal)', () => {
    expect(isActiveStatus('cancelled')).toBe(false);
  });

  it('returns false for "delivered" (complete group)', () => {
    expect(isActiveStatus('delivered')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isActiveStatus(null)).toBe(false);
  });
});

// ── STATUS_REGISTRY completeness ──────────────────────────────────────────────

describe('STATUS_REGISTRY completeness', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(STATUS_REGISTRY)).toBe(true);
    expect(STATUS_REGISTRY.length).toBeGreaterThan(0);
  });

  it('every entry has required string fields', () => {
    for (const entry of STATUS_REGISTRY) {
      expect(typeof entry.key, `key on ${entry.key}`).toBe('string');
      expect(typeof entry.customerLabel, `customerLabel on ${entry.key}`).toBe('string');
      expect(typeof entry.companyLabel, `companyLabel on ${entry.key}`).toBe('string');
      expect(typeof entry.tone, `tone on ${entry.key}`).toBe('string');
      expect(typeof entry.workflowGroup, `workflowGroup on ${entry.key}`).toBe('string');
    }
  });

  it('every entry has boolean terminal field', () => {
    for (const entry of STATUS_REGISTRY) {
      expect(typeof entry.terminal, `terminal on ${entry.key}`).toBe('boolean');
    }
  });

  it('every entry has permittedActions array with at least "view"', () => {
    for (const entry of STATUS_REGISTRY) {
      expect(Array.isArray(entry.permittedActions), `permittedActions on ${entry.key}`).toBe(true);
      expect(entry.permittedActions, `view in ${entry.key}`).toContain('view');
    }
  });

  it('every entry has aliases array', () => {
    for (const entry of STATUS_REGISTRY) {
      expect(Array.isArray(entry.aliases), `aliases on ${entry.key}`).toBe(true);
    }
  });

  it('terminal entries do not allow edit or post_to_exchange', () => {
    for (const entry of STATUS_REGISTRY.filter((e) => e.terminal)) {
      expect(entry.permittedActions, `edit not in ${entry.key}`).not.toContain('edit');
      expect(entry.permittedActions, `post_to_exchange not in ${entry.key}`).not.toContain('post_to_exchange');
    }
  });

  it('contains at least "cancelled" and "paid" as terminal states', () => {
    const terminalKeys = STATUS_REGISTRY.filter((e) => e.terminal).map((e) => e.key);
    expect(terminalKeys).toContain('cancelled');
    expect(terminalKeys).toContain('paid');
  });
});
