import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const layout = source('app/super-admin/layout.tsx');
const visualContract = source('app/super-admin/super-admin-visual-contract.css');

describe('Super Admin visual unification contract', () => {
  it('loads the visual contract after the legacy light-theme guards', () => {
    const hardeningIndex = layout.indexOf("import './super-admin-light-hardening.css'");
    const visualIndex = layout.indexOf("import './super-admin-visual-contract.css'");
    expect(hardeningIndex).toBeGreaterThanOrEqual(0);
    expect(visualIndex).toBeGreaterThan(hardeningIndex);
  });

  it('is scoped to Super Admin and standardizes the core control-plane primitives', () => {
    expect(visualContract).toContain('.super-admin-light-root');
    expect(visualContract).toContain('.super-admin-light-root main h1');
    expect(visualContract).toContain('.super-admin-light-root main table');
    expect(visualContract).toContain('.super-admin-light-root main th');
    expect(visualContract).toContain('.super-admin-light-root main td');
    expect(visualContract).toContain('.super-admin-light-root main button');
    expect(visualContract).toContain('.super-admin-light-root main [role="alert"]');
    expect(visualContract).toContain('--sa-ui-radius: 8px');
  });

  it('keeps semantic status colours page-owned while unifying geometry only', () => {
    expect(visualContract).toContain('Status chips / badges keep their meaning');
    expect(visualContract).not.toContain('background: var(--sa-ui-success) !important');
    expect(visualContract).not.toContain('background: var(--sa-ui-danger) !important');
  });

  it('contains no cross-workspace selector or production mutation surface', () => {
    expect(visualContract).not.toContain('/broker');
    expect(visualContract).not.toContain('/customer');
    expect(visualContract).not.toContain('/driver');
    expect(visualContract).not.toContain('fetch(');
    expect(visualContract).not.toContain('supabase');
  });
});
