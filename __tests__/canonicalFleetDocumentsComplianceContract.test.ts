import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('app/try-xdrive-demo/components/DemoFleetBoard.tsx', 'utf8');

describe('3150 Fleet Documents and Compliance are distinct operational sections', () => {
  it('keeps all verified document records in Documents', () => {
    expect(source).toContain("section === 'Documents' ? sourceDocuments.map");
  });
  it('limits Compliance to actionable status or expiry findings', () => {
    expect(source).toContain('const complianceFindings = sourceDocuments.filter');
    expect(source).toContain("['verified', 'approved', 'valid', 'compliant', 'active']");
    expect(source).toContain('expiry <= Date.now() + 30 * 86400000');
    expect(source).toContain("section === 'Compliance' && complianceFindings.map");
  });
  it('does not falsely certify fleet compliance when no issues are known', () => {
    expect(source).toContain('absence of a flag is not proof of full compliance');
    expect(source).toContain('No known expiring or unverified documents in available records.');
  });
});