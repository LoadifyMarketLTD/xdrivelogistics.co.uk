import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('canonical Settings route tabs parity', () => {
  const layouts = {
    admin: ['app/admin/settings/layout.tsx', '/admin/settings', '/admin/settings/legal-agreements'],
    driver: ['app/driver/settings/layout.tsx', '/driver/settings', '/driver/account/legal-agreements'],
    customer: ['app/customer/settings/layout.tsx', '/customer/settings', '/customer/account/legal-agreements'],
    broker: ['app/broker/settings/layout.tsx', '/broker/settings', '/broker/account/legal-agreements'],
  } as const;

  it.each(Object.entries(layouts))('%s uses the same Settings / Legal & Agreements tab structure', (_role, [file, settingsHref, legalHref]) => {
    const source = read(file);
    expect(source).toContain('WorkspaceRouteTabs');
    expect(source).toContain('ariaLabel="Account settings"');
    expect(source).toContain(`{ href: '${settingsHref}', label: 'Settings' }`);
    expect(source).toContain(`{ href: '${legalHref}', label: 'Legal & Agreements' }`);
  });
});
