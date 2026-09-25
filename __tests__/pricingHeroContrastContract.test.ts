import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'app/pricing/layout.tsx'), 'utf8');
const page = fs.readFileSync(path.join(process.cwd(), 'app/pricing/page.tsx'), 'utf8');

describe('Pricing hero contrast contract', () => {
  it('does not force a legacy dark background over the current hero composition', () => {
    expect(layout).not.toContain('.min-h-screen > main > section:first-child');
    expect(layout).not.toContain('background: linear-gradient(135deg, #173B73 0%, #0E2D5A 100%) !important');
  });

  it('keeps the pricing page responsible for its own hero colours', () => {
    expect(page).toContain('Simple pricing. First 3 months free.');
    expect(page).toContain('text-[#102447]');
  });
});
