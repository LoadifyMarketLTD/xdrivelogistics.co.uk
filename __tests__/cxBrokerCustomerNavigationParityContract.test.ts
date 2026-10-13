import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');
const brokerNetworkLayout = fs.readFileSync(path.join(process.cwd(), 'app/broker/carrier-network/layout.tsx'), 'utf8');
const customerNetworkLayout = fs.readFileSync(path.join(process.cwd(), 'app/customer/network/layout.tsx'), 'utf8');
const workspaceUi = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceUI.tsx'), 'utf8');

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

  it('uses the shared PR675-style route tab primitive for broker and customer network subnavigation', () => {
    expect(workspaceUi).toContain('export function WorkspaceRouteTabs');
    expect(workspaceUi).toContain('workspace-tab-strip workspace-route-tabs');
    expect(brokerNetworkLayout).toContain('<WorkspaceRouteTabs');
    expect(customerNetworkLayout).toContain('<WorkspaceRouteTabs');
    expect(brokerNetworkLayout).not.toContain('minHeight: 38');
    expect(customerNetworkLayout).not.toContain('minHeight: 38');
  });
});
