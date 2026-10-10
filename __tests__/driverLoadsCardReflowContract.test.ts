import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/loads/page.tsx', 'utf8');
const css = readFileSync('app/driver/driver-full-prototype.css', 'utf8');

describe('Driver Loads card breathing-room structure', () => {
  it('uses three explicit primary columns', () => {
    expect(page).toContain('<div className="load-primary">');
    expect(page).toContain('<div className="load-route">');
    expect(page).toContain('<div className="load-times">');
    expect(page).toContain('<div className="load-member">');
  });

  it('moves quick facts to a permanent second row', () => {
    expect(page).toContain('className="load-facts-row"');
    for (const label of ['To Collection','Job Distance','Weight','Packaging','Dimensions','Payment Terms','POD']) {
      expect(page).toContain('<b>' + label + '</b>');
    }
  });

  it('only renders notes and requirements when they exist', () => {
    expect(page).toContain('load.public_quote_notes ?');
    expect(page).toContain('load.handling_requirements.length > 0');
    expect(page).not.toContain("load.public_quote_notes ?? 'No public quote notes supplied.'");
  });

  it('uses a two-level footer with actions and identity separated', () => {
    expect(page).toContain('className="load-card-footer-main"');
    expect(page).toContain('className="load-card-footer-actions"');
    expect(page).toContain('className="load-card-footer-identity"');
  });

  it('adds breathing room without removing information', () => {
    expect(css).toContain('PR675 Loads card structural reflow');
    expect(css).toContain('min-height:74px!important');
    expect(css).toContain('min-height:42px!important');
    expect(css).toContain('min-height:50px!important');
  });

  it('removes the unused fmtDate helper that broke Netlify lint', () => {
    expect(page).not.toContain('function fmtDate(');
  });
});