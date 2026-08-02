/**
 * Unit tests for validateJobTransition — the runtime transition enforcement
 * guard in lib/jobs/jobOperationalContract.ts.
 *
 * Covered scenarios:
 *   1. Allowed transition — returns ok: true
 *   2. Rejected transition — status has transitions defined but target not in list
 *   3. Terminal status — no transitions permitted (cancelled, delivered, etc.)
 *   4. Unknown/unrecognised current status — treated as no-transitions allowed
 *   5. Missing job — id not found in jobs array
 *   6. Foreign job — job found but owned by a different company
 *   7. Post transition — draft → posted uses the same contract
 *   8. Post on foreign job is rejected (not just status-checked)
 *   9. Case-insensitive current-status lookup
 */
import { describe, expect, it } from 'vitest';
import {
  validateJobTransition,
  type JobTransitionRecord,
  type TransitionValidationResult,
} from '../lib/jobs/jobOperationalContract';
import { JOB_STATUS } from '../app/config/company';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CO = 'company-aaa';
const CO_OTHER = 'company-bbb';

function makeRecord(
  id: string,
  status: string,
  companyId: string = CO,
): JobTransitionRecord {
  return { id, status, companyId };
}

function validate(
  records: JobTransitionRecord[],
  id: string,
  newStatus: string,
  activeCompanyId: string = CO,
): TransitionValidationResult {
  return validateJobTransition({ jobs: records, id, newStatus, activeCompanyId });
}

// ─── 1. Allowed transitions ───────────────────────────────────────────────────

describe('validateJobTransition — allowed transitions', () => {
  it('allows draft → posted', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED)],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(true);
  });

  it('allows draft → cancelled', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED)],
      'j1',
      JOB_STATUS.CANCELLED,
    );
    expect(result.ok).toBe(true);
  });

  it('allows posted → cancelled', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.POSTED)],
      'j1',
      JOB_STATUS.CANCELLED,
    );
    expect(result.ok).toBe(true);
  });

  it('allows allocated → cancelled', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.ALLOCATED)],
      'j1',
      JOB_STATUS.CANCELLED,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── 2. Rejected transitions (status has transitions but target not allowed) ──

describe('validateJobTransition — rejected transitions', () => {
  it('rejects draft → allocated (skips posted)', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED)],
      'j1',
      JOB_STATUS.ALLOCATED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid-transition');
      expect(result.message).toContain('draft');
      expect(result.message).toContain(JOB_STATUS.ALLOCATED);
    }
  });

  it('rejects posted → allocated (not in allowed list)', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.POSTED)],
      'j1',
      JOB_STATUS.ALLOCATED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid-transition');
  });

  it('includes allowed statuses in the error message', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED)],
      'j1',
      JOB_STATUS.DELIVERED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Error message must mention allowed transitions
      expect(result.message).toMatch(/posted|cancelled/i);
    }
  });
});

// ─── 3. Terminal statuses — no transitions allowed ────────────────────────────

describe('validateJobTransition — terminal statuses', () => {
  const TERMINALS = [
    JOB_STATUS.CANCELLED,
    JOB_STATUS.DELIVERED,
    JOB_STATUS.PAID,
    JOB_STATUS.DISPUTED,
    JOB_STATUS.IN_TRANSIT,
    JOB_STATUS.INVOICED,
  ] as const;

  for (const terminal of TERMINALS) {
    it(`rejects any transition from terminal status '${terminal}'`, () => {
      const result = validate(
        [makeRecord('j1', terminal)],
        'j1',
        JOB_STATUS.POSTED,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid-transition');
        // Allowed should be 'none'
        expect(result.message).toMatch(/none/i);
      }
    });
  }
});

// ─── 4. Unknown / unrecognised current status ─────────────────────────────────

describe('validateJobTransition — unknown current status', () => {
  it('rejects any transition from an unknown status', () => {
    const result = validate(
      [makeRecord('j1', 'mystery_status')],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid-transition');
  });

  it('treats empty string current status as unknown', () => {
    const result = validate(
      [makeRecord('j1', '')],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid-transition');
  });
});

// ─── 5. Missing job ────────────────────────────────────────────────────────────

describe('validateJobTransition — missing job', () => {
  it('returns missing-job error when id not in jobs array', () => {
    const result = validate([], 'nonexistent-id', JOB_STATUS.POSTED);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('missing-job');
    expect(result.message).toContain('nonexist');
    }
  });

  it('returns missing-job error even if jobs array has other records', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED), makeRecord('j2', JOB_STATUS.POSTED)],
      'j-unknown',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('missing-job');
  });
});

// ─── 6. Foreign job (owned by different company) ──────────────────────────────

describe('validateJobTransition — foreign job', () => {
  it('rejects mutation when job is owned by a different company', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED, CO_OTHER)],
      'j1',
      JOB_STATUS.POSTED,
      CO,   // active company is CO, but job owned by CO_OTHER
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('foreign-job');
    }
  });

  it('rejects foreign job even when newStatus is otherwise valid', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.POSTED, CO_OTHER)],
      'j1',
      JOB_STATUS.CANCELLED,
      CO,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('foreign-job');
  });

  it('allows mutation when companyId matches exactly', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.POSTED, CO)],
      'j1',
      JOB_STATUS.CANCELLED,
      CO,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── 7. Post transition uses the same contract ────────────────────────────────

describe('validateJobTransition — Post action (draft → posted)', () => {
  it('allows draft → posted (Post action contract)', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.RECEIVED)],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects Post on already-posted job (idempotency guard)', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.POSTED)],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid-transition');
  });

  it('rejects Post on cancelled job', () => {
    const result = validate(
      [makeRecord('j1', JOB_STATUS.CANCELLED)],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(false);
  });
});

// ─── 8. Foreign job is rejected before status is checked ─────────────────────

describe('validateJobTransition — guard ordering', () => {
  it('reports foreign-job before invalid-transition when both conditions apply', () => {
    // Job is foreign AND transition would be invalid
    const result = validate(
      [makeRecord('j1', JOB_STATUS.CANCELLED, CO_OTHER)],
      'j1',
      JOB_STATUS.POSTED,
      CO,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // foreign-job check must come before transition check
      expect(result.error).toBe('foreign-job');
    }
  });
});

// ─── 9. Case-insensitive status lookup ───────────────────────────────────────

describe('validateJobTransition — case-insensitive status', () => {
  it('allows transition when current status is upper-case', () => {
    const result = validate(
      [makeRecord('j1', 'DRAFT')],
      'j1',
      JOB_STATUS.POSTED,
    );
    expect(result.ok).toBe(true);
  });

  it('allows transition when current status is mixed-case', () => {
    const result = validate(
      [makeRecord('j1', 'Draft')],
      'j1',
      JOB_STATUS.CANCELLED,
    );
    expect(result.ok).toBe(true);
  });
});
