import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/history/page.tsx', 'utf8');
const css = readFileSync('app/driver/history/diary-exchange.css', 'utf8');

describe('Owner Driver Diary inherits Loads card grammar', () => {
  it('keeps the Diary card as a three-column operational record', () => {
    expect(page).toContain('driver-diary-entry__top');
    expect(page).toContain('driver-diary-status-band');
    expect(css).toContain('grid-template-columns:minmax(0,1.12fr) minmax(0,1fr) minmax(300px,.98fr)!important');
  });

  it('places expanded detail before the action footer like Loads', () => {
    expect(css).toContain('>.driver-diary-entry__top{order:1!important}');
    expect(css).toContain('>.driver-row-details{order:2!important}');
    expect(css).toContain('>.driver-diary-action-rail{order:3!important}');
  });

  it('retains Diary-only operational capabilities', () => {
    for (const label of ['POD','Order','Notes','History','Documents','Invoice','Leave Feedback']) {
      expect(page).toContain(label);
    }
    expect(page).toContain('Booked by:');
    expect(page).toContain('Agreed rate:');
    expect(page).toContain('Payment terms:');
  });

  it('uses a compact footer strip and Loads-like status band', () => {
    expect(css).toContain('height:30px!important');
    expect(css).toContain('position:absolute!important');
    expect(css).toContain('top:8px!important');
  });
});