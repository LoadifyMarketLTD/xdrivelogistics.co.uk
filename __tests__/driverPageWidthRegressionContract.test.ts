import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver page width regression contract', () => {
  const layout = fs.readFileSync(path.join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-page-width-fix.css'), 'utf8');

  it('loads the width fix after legacy prototype CSS', () => {
    expect(layout.indexOf("import './driver-page-width-fix.css'")).toBeGreaterThan(layout.indexOf("import './driver-full-prototype.css'"));
  });

  it('forces Action Centre and Live Availability to occupy the full workspace width', () => {
    expect(css).toContain('.top-workspace-shell__content.driver-prototype-app');
    expect(css).toContain('.driver-prototype-page-shell > .pagebody.no-left');
    expect(css).toContain('.driver-action-centre-board');
    expect(css).toContain('.driver-live-availability-canonical');
    expect(css).toContain('width: 100% !important');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important');
  });
});
