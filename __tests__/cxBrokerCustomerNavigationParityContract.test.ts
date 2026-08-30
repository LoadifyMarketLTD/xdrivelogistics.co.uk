import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('CX-close broker/customer navigation discoverability', () => {
  it('uses Directory terminology for broker and customer network routes', () => {
    expect(source).toContain("id: 'broker-directory', label: 'Directory'");
    expect(source).toContain("href: '/broker/carrier-network'");
    expect(source).toContain("id: 'customer-directory', label: 'Directory'");
    expect(source).toContain("href: '/customer/network'");
  });

  it('exposes the existing broker dispute register without broadening permissions', () => {
    expect(source).toContain("id: 'broker-disputes', label: 'Disputes'");
    expect(source).toContain("href: '/broker/disputes'");
    expect(source).toContain("capability: 'incidents.manage'");
    expect(source).toContain("broker: new Set<WorkspaceCapability>(['company.manage'");
  });

  it('does not grant customer incident-management rights just to mirror broker navigation', () => {
    const customerCapabilities = source.slice(
      source.indexOf("customer: new Set<WorkspaceCapability>"),
      source.indexOf("fleet_manager: new Set<WorkspaceCapability>"),
    );
    expect(customerCapabilities).not.toContain("'incidents.manage'");
  });
});
