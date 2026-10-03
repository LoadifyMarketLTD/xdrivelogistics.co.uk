import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/sheet/route.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'app/components/workspace/CompanyJobSheetPanel.tsx'), 'utf8');

describe('workspace job sheet mandatory POD truth', () => {
  it('enforces digital POD for every job regardless of historical flags', () => {
    expect(route).toContain('const podRequired = true;');
    expect(panel).toContain('required: boolean;');
  });

  it('never presents POD as optional or unknown', () => {
    expect(panel).not.toContain("label: 'Not required'");
    expect(panel).not.toContain("label: 'Requirement not supplied'");
    expect(panel).not.toContain('This booking does not require POD evidence.');
    expect(panel).toContain('Digital POD required; hard-copy requirement not separately supplied');
  });

  it('keeps no-evidence bookings pending until POD evidence is completed', () => {
    expect(panel).toContain("label: 'Pending'");
    expect(panel).toContain('POD is mandatory and no generated POD or delivery evidence is recorded.');
  });
});
