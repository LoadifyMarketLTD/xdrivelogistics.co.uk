import { describe, expect, it } from 'vitest';
import { SENTIMENT_COLORS, TREND_ARROWS, workspaceTheme } from '../app/components/workspace/WorkspaceUI';
import type { KpiTrend } from '../app/components/workspace/WorkspaceUI';

/**
 * KpiTrend contract tests.
 *
 * These tests verify the exported KpiTrend type shape and its runtime
 * presentation mappings (colour from sentiment, arrow from direction)
 * without requiring a DOM or React rendering environment.
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

describe('SENTIMENT_COLORS presentation mapping', () => {
  it('positive sentiment maps to green regardless of direction', () => {
    expect(SENTIMENT_COLORS.positive).toBe(workspaceTheme.green);
  });

  it('negative sentiment maps to red regardless of direction', () => {
    expect(SENTIMENT_COLORS.negative).toBe(workspaceTheme.red);
  });

  it('neutral sentiment maps to muted', () => {
    expect(SENTIMENT_COLORS.neutral).toBe(workspaceTheme.muted);
  });

  it('direction:up with sentiment:negative uses red, not green', () => {
    const trend: KpiTrend = { delta: '+5 incidents', direction: 'up', sentiment: 'negative' };
    const color = SENTIMENT_COLORS[trend.sentiment ?? 'neutral'];
    expect(color).toBe(workspaceTheme.red);
    expect(color).not.toBe(workspaceTheme.green);
  });

  it('direction:down with sentiment:positive uses green, not red', () => {
    const trend: KpiTrend = { delta: '−8 overdue', direction: 'down', sentiment: 'positive' };
    const color = SENTIMENT_COLORS[trend.sentiment ?? 'neutral'];
    expect(color).toBe(workspaceTheme.green);
    expect(color).not.toBe(workspaceTheme.red);
  });

  it('omitted sentiment defaults to neutral (muted), not direction-inferred colour', () => {
    const trend: KpiTrend = { delta: 'n/a', direction: 'up' };
    const color = SENTIMENT_COLORS[trend.sentiment ?? 'neutral'];
    expect(color).toBe(workspaceTheme.muted);
    expect(color).not.toBe(workspaceTheme.green);
    expect(color).not.toBe(workspaceTheme.red);
  });
});

describe('TREND_ARROWS direction mapping', () => {
  it('up direction uses up arrow', () => {
    expect(TREND_ARROWS.up).toBe('↑');
  });

  it('down direction uses down arrow', () => {
    expect(TREND_ARROWS.down).toBe('↓');
  });

  it('neutral direction uses right arrow', () => {
    expect(TREND_ARROWS.neutral).toBe('→');
  });

  it('arrow is independent of sentiment — up+negative still shows up arrow', () => {
    const trend: KpiTrend = { delta: '+5 incidents', direction: 'up', sentiment: 'negative' };
    expect(TREND_ARROWS[trend.direction]).toBe('↑');
  });
});

