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

  it('shows quick facts only inside the expandable detail region', () => {
    expect(page).toContain("className={'load-extra cx-load-extra ' + (expanded ? '' : 'hidden')}");
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

  it('uses one compact footer strip like CX', () => {
    expect(page).toContain('className="load-card-footer"');
    expect(page).toContain('className="load-footer-spacer"');
    expect(page).toContain('className="load-footer-identity"');
    expect(page).not.toContain('className="load-card-footer-main"');
  });

  it('keeps collapsed cards compact while preserving expanded facts', () => {
    expect(css).toContain('min-height:68px!important');
    expect(css).toContain('min-height:42px!important');
    expect(css).toContain('height:30px!important');
    expect(css).toContain('min-height:0!important');
  });

  it('removes the unused fmtDate helper that broke Netlify lint', () => {
    expect(page).not.toContain('function fmtDate(');
  });
});