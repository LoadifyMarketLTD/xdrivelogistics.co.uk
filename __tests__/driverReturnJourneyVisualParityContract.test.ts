import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver Return Journeys visual parity contract', () => {
  const page = read('app/driver/returns/page.tsx');
  const css = read('app/driver/driver-prototype-parity.css');

  it('uses CX-style journey cards instead of a wide generic table', () => {
    expect(page).toContain('return-journey-card');
    expect(page).toContain('return-journey-card__top');
    expect(page).toContain('return-journey-card__meta');
    expect(page).toContain('return-journey-card__actions');
    expect(page).not.toContain('<th>Journey</th><th>Route</th><th>Departs At</th>');
  });

  it('shows the operational journey facts visible in the exchange register', () => {
    for (const marker of ['Departs At', 'ETA', 'Empty Vehicle', 'Journey ID:', 'Posted', 'Weight', 'Space', 'Distance', 'Member']) {
      expect(page).toContain(marker);
    }
    expect(page).toContain('journey.availableTo ? fmtDate(journey.availableTo)');
    expect(page).toContain('journey.journeyDistanceMiles');
  });

  it('exposes from/to radius and All/Ad Hoc/Regular filters as first-class controls', () => {
    expect(page).toContain('To / Radius');
    expect(page).toContain('return-kind-tabs');
    expect(page).toContain("['all', 'All']");
    expect(page).toContain("['ad_hoc', 'Ad Hoc']");
    expect(page).toContain("['regular', 'Regular']");
  });

  it('keeps actions truthful and avoids invented marketplace controls', () => {
    expect(page).toContain("{open ? 'Close' : 'Track'}");
    expect(page).toContain('Open Route');
    expect(page).not.toContain('View Feedback</button>');
    expect(page).not.toContain('Book Direct</button>');
  });

  it('locks the compact exchange presentation in CSS', () => {
    expect(css).toContain('.return-journey-card{');
    expect(css).toContain('grid-template-columns:1.35fr 1.05fr .62fr');
    expect(css).toContain('.return-kind-tabs');
    expect(css).toContain('border:1px solid #9fc965');
  });
});
