import { describe, expect, it } from 'vitest';
import type { KpiTrend } from '../app/components/workspace/WorkspaceUI';

/**
 * KpiTrend contract tests.
 *
 * These tests verify the exported KpiTrend type shape and its runtime
 * direction values without requiring a DOM or React rendering environment.
 * They mirror the project's existing pure-TypeScript test pattern.
 */
describe('KpiTrend contract', () => {
  it('accepts the up direction with delta and optional label', () => {
    const trend: KpiTrend = { delta: '+12 %', direction: 'up', label: 'vs last month' };
    expect(trend.direction).toBe('up');
    expect(trend.delta).toBe('+12 %');
    expect(trend.label).toBe('vs last month');
  });

  it('accepts the down direction with delta only', () => {
    const trend: KpiTrend = { delta: '−3', direction: 'down' };
    expect(trend.direction).toBe('down');
    expect(trend.label).toBeUndefined();
  });

  it('accepts the neutral direction', () => {
    const trend: KpiTrend = { delta: 'stable', direction: 'neutral' };
    expect(trend.direction).toBe('neutral');
  });

  it('covers all three direction values', () => {
    const directions: KpiTrend['direction'][] = ['up', 'down', 'neutral'];
    expect(new Set(directions).size).toBe(3);
  });
});
