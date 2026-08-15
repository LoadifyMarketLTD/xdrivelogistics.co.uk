import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/sheet/route.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'app/components/workspace/CompanyJobSheetPanel.tsx'), 'utf8');

describe('workspace job sheet POD truth', () => {
  it('does not fabricate a POD-required default when the contract has no value', () => {
    expect(route).toContain('const podRequired = boolValue(agreement.pod_required) ?? boolValue(job.pod_required);');
    expect(route).not.toContain('boolValue(job.pod_required) ?? true');
  });

  it('presents unknown POD requirements as not supplied', () => {
    expect(panel).toContain('required: boolean | null');
    expect(panel).toContain("sheet.pod.required == null ? 'Not supplied'");
    expect(panel).toContain("label: 'Requirement not supplied'");
  });

  it('does not label a no-evidence booking as pending when POD is explicitly not required', () => {
    expect(panel).toContain("sheet.pod.required === false");
    expect(panel).toContain("label: 'Not required'");
    expect(panel).toContain('This booking does not require POD evidence.');
  });
});
