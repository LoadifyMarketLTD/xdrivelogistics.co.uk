import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const form = read('app/components/workspace/LoadPostingForm.tsx');

describe('Post Load parity across authorized posting workspaces', () => {
  it('reuses the carrier posting form for customer, broker and owner driver', () => {
    expect(read('app/admin/post-load/page.tsx')).toContain('<LoadPostingForm mode="admin" />');
    expect(read('app/customer/CustomerWorkspaceModules.tsx')).toContain('<LoadPostingForm mode="customer"/>');
    expect(read('app/broker/post-load/page.tsx')).toContain('<LoadPostingForm mode="broker" />');
    expect(read('app/driver/post-load/page.tsx')).toContain('<LoadPostingForm mode="owner" />');
  });
  it('does not hide carrier booking targets or customer fields from authorized posting modes', () => {
    expect(form).not.toContain("mode !== 'customer' && (");
    expect(form).not.toContain("(mode === 'admin' || mode === 'owner') && (");
    expect(form).toContain("directTargetMode === 'external_subcontractor' && (");
    expect(form).toContain("directTargetMode === 'internal_resource' && (");
    expect(form).toContain('style={{ order: 3 }} title="Customer"');
    expect(form).toContain('mode: mode === \'owner\' ? \'admin\' : mode');
  });
});
