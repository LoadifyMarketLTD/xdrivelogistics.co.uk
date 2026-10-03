import fs from 'node:fs';
import path from 'node:path';

describe('Owner Driver P0 dashboard geometry contract', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');

  it('matches status and readiness columns to the three real P0 signals', () => {
    const statusStart = page.indexOf('<section className="driver-dashboard-statusbar"');
    const statusEnd = page.indexOf('</section>', statusStart);
    const statusSection = page.slice(statusStart, statusEnd);
    const readinessStart = page.indexOf('<section className="driver-dashboard-readiness"');
    const readinessGridStart = page.indexOf('<div className="driver-dashboard-readiness__grid">', readinessStart);
    const readinessGridEnd = page.indexOf('</div>', readinessGridStart);
    const readinessGrid = page.slice(readinessGridStart, readinessGridEnd);

    expect(statusSection.match(/<button /g)?.length).toBe(3);
    expect(readinessGrid.match(/<button /g)?.length).toBe(3);
    expect(css).toContain('.xdrive-driver-workspace .driver-dashboard-statusbar{');
    expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr));');
    expect(css).toContain('.xdrive-driver-workspace .driver-dashboard-readiness__grid{');
  });

  it('stacks the P0 signal grids without leaving quota-driven empty columns on mobile', () => {
    expect(css).toContain('@media(max-width:768px){');
    expect(css).toContain('.xdrive-driver-workspace .driver-dashboard-readiness__grid{grid-template-columns:1fr}');
    expect(css).not.toContain('.driver-dashboard-statusbar{grid-template-columns:repeat(6,minmax(0,1fr))}');
    expect(css).not.toContain('.driver-dashboard-readiness__grid{grid-template-columns:repeat(4,minmax(0,1fr))}');
  });
});
