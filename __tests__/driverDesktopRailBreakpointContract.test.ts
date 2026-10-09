import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver desktop rail breakpoint contract', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');

  it('does not collapse operational two-column boards at desktop/tablet widths', () => {
    expect(css).not.toContain('@media (max-width: 1200px) {\n  .xdrive-driver-workspace .driver-board-layout');
    expect(css).toContain('@media (max-width: 760px) {');
  });
});
