import { describe, expect, it } from 'vitest';
import {
  hasOnlyPreExecutionJobStatuses,
  jobLifecycleStatuses,
  preferredJobLifecycleStatus,
  terminalJobStatus,
} from '../lib/jobs/jobLifecycleStatus';

describe('job lifecycle status guard', () => {
  it('keeps matching pre-execution states mutable', () => {
    const job = { status: 'posted', current_status: 'posted' };
    expect(jobLifecycleStatuses(job)).toEqual(['posted']);
    expect(hasOnlyPreExecutionJobStatuses(job)).toBe(true);
    expect(terminalJobStatus(job)).toBeNull();
    expect(preferredJobLifecycleStatus(job)).toBe('posted');
  });

  it('fails closed when legacy status is cancelled but current_status is stale posted', () => {
    const job = { status: 'cancelled', current_status: 'posted' };
    expect(jobLifecycleStatuses(job)).toEqual(['posted', 'cancelled']);
    expect(hasOnlyPreExecutionJobStatuses(job)).toBe(false);
    expect(terminalJobStatus(job)).toBe('cancelled');
    expect(preferredJobLifecycleStatus(job)).toBe('cancelled');
  });

  it('fails closed when either lifecycle field has progressed beyond pre-execution', () => {
    const job = { status: 'posted', current_status: 'awarded' };
    expect(hasOnlyPreExecutionJobStatuses(job)).toBe(false);
    expect(preferredJobLifecycleStatus(job)).toBe('awarded');
  });

  it('recognises terminal state from either lifecycle field', () => {
    expect(terminalJobStatus({ status: 'delivered', current_status: 'in_transit' })).toBe('delivered');
    expect(terminalJobStatus({ status: 'in_transit', current_status: 'completed' })).toBe('completed');
  });
});
