import { describe, expect, it } from 'vitest';
import { getOperationalWorkspaceRoot, resolveLegalRemediationUrl } from '../lib/workspaceRemediation';

describe('workspace remediation navigation', () => {
  it.each([
    ['admin', '/admin/settings/legal-agreements'],
    ['customer', '/customer/account/legal-agreements'],
    ['broker', '/broker/account/legal-agreements'],
    ['owner', '/driver/account/legal-agreements'],
  ] as const)('keeps %s legal recovery in the signed-in workspace', (mode, expected) => {
    expect(resolveLegalRemediationUrl('/admin/settings/legal-agreements', mode)).toBe(expected);
  });
  it.each([undefined, null, '', '/help', '//example.com', 'javascript:alert(1)', 'https://example.com', '/admin/settings/legal-agreements?next=//example.com'])('rejects unsafe or absent recovery URLs: %s', (url) => {
    expect(resolveLegalRemediationUrl(url, 'admin')).toBeNull();
  });
  it('does not turn a counterparty restriction without a URL into self-remediation', () => {
    expect(resolveLegalRemediationUrl(undefined, 'owner')).toBeNull();
  });
  it.each(['admin', 'customer', 'broker', 'driver'])('recognises the %s workspace', (root) => {
    expect(getOperationalWorkspaceRoot(`/${root}/settings/billing`)).toBe(`/${root}`);
  });
  it.each(['/super-admin/settings', '/admin-other', '/settings/billing'])('does not reclassify %s', (path) => {
    expect(getOperationalWorkspaceRoot(path)).toBeNull();
  });
});
