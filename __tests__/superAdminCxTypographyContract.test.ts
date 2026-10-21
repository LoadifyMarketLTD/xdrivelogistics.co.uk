import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Super Admin CX readable typography', () => {
  const layout = read('app/super-admin/layout.tsx');
  const typography = read('app/super-admin/super-admin-cx-typography.css');

  it('loads the CX typography layer after the enterprise visual contract', () => {
    const visualIndex = layout.indexOf("import './super-admin-visual-contract.css'");
    const cxIndex = layout.indexOf("import './super-admin-cx-typography.css'");
    expect(visualIndex).toBeGreaterThanOrEqual(0);
    expect(cxIndex).toBeGreaterThan(visualIndex);
  });

  it('uses the CX font family and readable body floor', () => {
    expect(typography).toContain('font-family: "HK Nova", Arial, sans-serif;');
    expect(typography).toContain('--sa-font-body: 14px;');
    expect(typography).toContain('font-size: 14px !important;');
    expect(typography).toContain('line-height: 18px !important;');
  });

  it('keeps navigation compact but readable and headings clearly larger', () => {
    expect(typography).toContain('font-size: 13px !important;');
    expect(typography).toContain('--sa-font-heading: 16px;');
    expect(typography).toContain('--sa-font-page-title: 20px;');
  });
});
