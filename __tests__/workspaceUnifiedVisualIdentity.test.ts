import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const baseline = readFileSync('app/components/workspace/workspace-measured-cx-baseline.css','utf8');
const admin = readFileSync('app/admin/layout.tsx','utf8');
const broker = readFileSync('app/broker/layout.tsx','utf8');
const customer = readFileSync('app/customer/layout.tsx','utf8');
const driver = readFileSync('app/driver/layout.tsx','utf8');
const superAdmin = readFileSync('app/super-admin/layout.tsx','utf8');

describe('Unified workspace visual identity excludes Super Admin',()=>{
  it('loads measured baseline in all operational workspace layouts',()=>{
    for (const src of [admin,broker,customer,driver]) expect(src).toContain('workspace-measured-cx-baseline.css');
  });
  it('keeps Super Admin on its own visual contract',()=>{
    expect(superAdmin).toContain('super-admin-visual-contract.css');
    expect(superAdmin).not.toContain('workspace-measured-cx-baseline.css');
  });
  it('pins the approved cross-role nav metrics',()=>{
    expect(baseline).toContain(".top-workspace-shell:not([data-workspace-role='platform_owner'])");
    expect(baseline).toContain('font-size:13px!important');
    expect(baseline).toContain('font-weight:600!important');
    expect(baseline).toContain('line-height:18px!important');
    expect(baseline).toContain('padding:0 13px!important');
    expect(baseline).toContain('--ws-nav-h: 42px;');
    expect(baseline).toContain('font-size:12.5px!important');
  });
  it('pins shared operational card typography and density',()=>{
    expect(baseline).toContain('--ws-font-body: 12px;');
    expect(baseline).toContain('--ws-font-label: 10.8px;');
    expect(baseline).toContain('--ws-font-meta: 10px;');
    expect(baseline).toContain('border-radius:0!important');
    expect(baseline).toContain('font-weight:450!important');
    expect(baseline).toContain('font-weight:650!important');
  });
});