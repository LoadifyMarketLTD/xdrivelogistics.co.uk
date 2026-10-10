import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/history/page.tsx', 'utf8');
const css = readFileSync('app/driver/history/diary-exchange.css', 'utf8');

describe('Owner Driver Diary operational timeline', () => {
  it('derives milestones only from existing tracking/status data', () => {
    expect(page).toContain("eventAt('on_my_way', 'on_my_way_to_pickup')");
    expect(page).toContain("eventAt('on_site_pickup')");
    expect(page).toContain("eventAt('loaded', 'collected')");
    expect(page).toContain("eventAt('on_site_delivery')");
    expect(page).toContain("eventAt('delivered', 'completed')");
  });

  it('renders CX-inspired milestone labels plus receiver and delivery status', () => {
    for (const label of ['On my way to pickup','On site at pickup','Loaded','On site at delivery','Delivered','Received by','Delivery status']) {
      expect(page).toContain(label);
    }
    expect(page).toContain('driver-diary-operational-timeline');
  });

  it('uses a compact four-column timeline layout', () => {
    expect(css).toContain('PR675 Diary: compact CX-inspired operational timeline');
    expect(css).toContain('grid-template-columns:repeat(4,minmax(0,1fr))!important');
    expect(css).toContain('min-height:48px!important');
  });
});