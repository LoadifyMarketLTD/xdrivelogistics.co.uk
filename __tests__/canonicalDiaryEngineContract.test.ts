import { describe, expect, it } from 'vitest';
import { getCanonicalDiaryTabs, matchesCanonicalDiaryBucket } from '../lib/diary/canonicalDiary';

const labels = (role: Parameters<typeof getCanonicalDiaryTabs>[0]) => getCanonicalDiaryTabs(role).map((item) => item.id);

describe('canonical Diary engine', () => {
  it('gives Customer the complete commercial lifecycle including expiry, feedback and evidence', () => {
    expect(labels('customer')).toEqual([
      'all',
      'open',
      'awaiting_award',
      'awarded',
      'in_progress',
      'completed',
      'cancelled',
      'expired',
      'awaiting_feedback',
      'recent_feedback',
      'evidence',
    ]);
  });

  it('keeps employed Driver focused on assigned execution rather than company allocation queues', () => {
    expect(labels('driver')).toEqual(['all', 'allocated', 'in_progress', 'completed', 'cancelled']);
    expect(labels('driver')).not.toContain('unallocated');
    expect(labels('owner_driver')).toContain('unallocated');
    expect(labels('owner_driver')).toContain('awaiting_feedback');
  });

  it('classifies feedback and POD evidence from canonical job facts', () => {
    const completed = { status: 'completed', current_status: 'completed', assigned_driver_id: 'driver-1', pod_generated: true };
    expect(matchesCanonicalDiaryBucket(completed, 'completed')).toBe(true);
    expect(matchesCanonicalDiaryBucket(completed, 'awaiting_feedback', { hasFeedback: false })).toBe(true);
    expect(matchesCanonicalDiaryBucket(completed, 'recent_feedback', { hasFeedback: true })).toBe(true);
    expect(matchesCanonicalDiaryBucket(completed, 'evidence')).toBe(true);
  });

  it('separates customer open work from awaiting-award work using submitted quote facts', () => {
    const posted = { status: 'posted', current_status: 'posted', assigned_driver_id: null };
    expect(matchesCanonicalDiaryBucket(posted, 'open', { hasSubmittedQuote: false })).toBe(true);
    expect(matchesCanonicalDiaryBucket(posted, 'awaiting_award', { hasSubmittedQuote: true })).toBe(true);
    expect(matchesCanonicalDiaryBucket(posted, 'open', { hasSubmittedQuote: true })).toBe(false);
  });
});
