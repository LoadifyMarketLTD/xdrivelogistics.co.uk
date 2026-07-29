import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StatusBadgeTone } from '../app/components/workspace/WorkspaceUI';
import { STATUS_BADGE_COLORS, StatusBadge } from '../app/components/workspace/WorkspaceUI';

/**
 * StatusBadge primitives — rendered-output assertions.
 *
 * Uses `renderToStaticMarkup` (react-dom/server, Node-safe) to verify the
 * actual component HTML.  No jsdom is required.  Colour assertions reference
 * the exported STATUS_BADGE_COLORS lookup, which is the single source of
 * truth for the palette.
 */

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

// ---------------------------------------------------------------------------
// STATUS_BADGE_COLORS — exported palette contract
// ---------------------------------------------------------------------------

describe('STATUS_BADGE_COLORS — palette contract', () => {
  it('covers exactly six tones', () => {
    const tones: StatusBadgeTone[] = ['green', 'blue', 'orange', 'red', 'grey', 'purple'];
    expect(new Set(tones).size).toBe(6);
    tones.forEach((tone) => {
      expect(STATUS_BADGE_COLORS[tone]).toBeDefined();
    });
  });

  it('each palette entry has bg, color and border fields', () => {
    const tones: StatusBadgeTone[] = ['green', 'blue', 'orange', 'red', 'grey', 'purple'];
    tones.forEach((tone) => {
      const palette = STATUS_BADGE_COLORS[tone];
      expect(typeof palette.bg).toBe('string');
      expect(typeof palette.color).toBe('string');
      expect(typeof palette.border).toBe('string');
      expect(palette.bg.length).toBeGreaterThan(0);
      expect(palette.color.length).toBeGreaterThan(0);
      expect(palette.border.length).toBeGreaterThan(0);
    });
  });

  it('all six tones have distinct bg values', () => {
    const tones: StatusBadgeTone[] = ['green', 'blue', 'orange', 'red', 'grey', 'purple'];
    const bgs = tones.map((t) => STATUS_BADGE_COLORS[t].bg);
    expect(new Set(bgs).size).toBe(6);
  });

  it('green tone uses a green background', () => {
    expect(STATUS_BADGE_COLORS.green.bg).toBe('#ecfdf3');
    expect(STATUS_BADGE_COLORS.green.color).toBe('#166534');
  });

  it('red tone uses a red background', () => {
    expect(STATUS_BADGE_COLORS.red.bg).toBe('#fef2f2');
    expect(STATUS_BADGE_COLORS.red.color).toBe('#b91c1c');
  });

  it('blue tone is distinct from green and red', () => {
    expect(STATUS_BADGE_COLORS.blue.bg).not.toBe(STATUS_BADGE_COLORS.green.bg);
    expect(STATUS_BADGE_COLORS.blue.bg).not.toBe(STATUS_BADGE_COLORS.red.bg);
  });
});

// ---------------------------------------------------------------------------
// StatusBadge — explicit tone rendering
// ---------------------------------------------------------------------------

describe('StatusBadge — explicit tone rendering', () => {
  it('renders the green palette when tone="green" is supplied explicitly', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'green' }));
    const palette = STATUS_BADGE_COLORS.green;
    expect(html).toContain(palette.bg);
    expect(html).toContain(palette.color);
    expect(html).toContain(palette.border);
  });

  it('renders the red palette when tone="red" is supplied explicitly', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'red' }));
    const palette = STATUS_BADGE_COLORS.red;
    expect(html).toContain(palette.bg);
    expect(html).toContain(palette.color);
    expect(html).toContain(palette.border);
  });

  it('renders the orange palette when tone="orange" is supplied explicitly', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'orange' }));
    const palette = STATUS_BADGE_COLORS.orange;
    expect(html).toContain(palette.bg);
    expect(html).toContain(palette.color);
  });

  it('renders the blue palette when tone="blue" is supplied explicitly', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'blue' }));
    const palette = STATUS_BADGE_COLORS.blue;
    expect(html).toContain(palette.bg);
    expect(html).toContain(palette.color);
  });

  it('renders the grey palette when tone="grey" is supplied explicitly', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'grey' }));
    const palette = STATUS_BADGE_COLORS.grey;
    expect(html).toContain(palette.bg);
    expect(html).toContain(palette.color);
  });

  it('renders the purple palette when tone="purple" is supplied explicitly', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'purple' }));
    const palette = STATUS_BADGE_COLORS.purple;
    expect(html).toContain(palette.bg);
    expect(html).toContain(palette.color);
  });

  it('explicit tone overrides what text inference would produce (red overrides "delivered")', () => {
    const explicitRed = render(React.createElement(StatusBadge, { value: 'delivered', tone: 'red' }));
    const inferredGreen = render(React.createElement(StatusBadge, { value: 'delivered' }));
    // explicit tone="red" must use the red palette
    expect(explicitRed).toContain(STATUS_BADGE_COLORS.red.bg);
    expect(explicitRed).not.toContain(STATUS_BADGE_COLORS.green.bg);
    // without explicit tone, text inference gives green
    expect(inferredGreen).toContain(STATUS_BADGE_COLORS.green.bg);
    expect(inferredGreen).not.toContain(STATUS_BADGE_COLORS.red.bg);
  });
});

// ---------------------------------------------------------------------------
// StatusBadge — label rendering
// ---------------------------------------------------------------------------

describe('StatusBadge — label rendering', () => {
  it('renders a plain value string as title-case label', () => {
    const html = render(React.createElement(StatusBadge, { value: 'pending' }));
    expect(html).toContain('Pending');
  });

  it('converts underscored value to spaced title-case', () => {
    const html = render(React.createElement(StatusBadge, { value: 'in_progress' }));
    expect(html).toContain('In Progress');
  });

  it('converts hyphenated value to spaced title-case', () => {
    const html = render(React.createElement(StatusBadge, { value: 'on-hold' }));
    expect(html).toContain('On Hold');
  });
});

// ---------------------------------------------------------------------------
// StatusBadge — ariaLabel accessibility
// ---------------------------------------------------------------------------

describe('StatusBadge — ariaLabel accessibility', () => {
  it('renders aria-label attribute when ariaLabel prop is supplied', () => {
    const html = render(
      React.createElement(StatusBadge, { value: 'active', tone: 'green', ariaLabel: 'Account is active' }),
    );
    expect(html).toContain('aria-label="Account is active"');
  });

  it('does not render aria-label attribute when ariaLabel prop is omitted', () => {
    const html = render(React.createElement(StatusBadge, { value: 'active', tone: 'green' }));
    expect(html).not.toContain('aria-label');
  });
});

// ---------------------------------------------------------------------------
// StatusBadge — text inference (backward compat — existing callers without tone)
// ---------------------------------------------------------------------------

describe('StatusBadge — tone inference for backward compatibility', () => {
  it('infers green for "delivered" when no tone is provided', () => {
    const html = render(React.createElement(StatusBadge, { value: 'delivered' }));
    expect(html).toContain(STATUS_BADGE_COLORS.green.bg);
  });

  it('infers red for "failed" when no tone is provided', () => {
    const html = render(React.createElement(StatusBadge, { value: 'failed' }));
    expect(html).toContain(STATUS_BADGE_COLORS.red.bg);
  });

  it('infers orange for "pending" when no tone is provided', () => {
    const html = render(React.createElement(StatusBadge, { value: 'pending' }));
    expect(html).toContain(STATUS_BADGE_COLORS.orange.bg);
  });

  it('infers grey for "draft" when no tone is provided', () => {
    const html = render(React.createElement(StatusBadge, { value: 'draft' }));
    expect(html).toContain(STATUS_BADGE_COLORS.grey.bg);
  });

  it('falls back to blue for unrecognised values', () => {
    const html = render(React.createElement(StatusBadge, { value: 'xyzunknown' }));
    expect(html).toContain(STATUS_BADGE_COLORS.blue.bg);
  });
});
