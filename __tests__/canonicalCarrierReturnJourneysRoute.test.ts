import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('canonical carrier Return Journeys route', () => {
  const legacy = read('app/admin/returns/page.tsx');
  const workflow = read('app/admin/workflowUi.tsx');
  const modules = read('app/admin/AdminWorkspaceModules.tsx');

  it('keeps /admin/returns only as a redirect alias', () => {
    expect(legacy).toContain("redirect('/admin/fleet/returns')");
    expect(legacy).not.toContain(".from('return_journeys')");
    expect(legacy).not.toContain('.delete()');
    expect(legacy).not.toContain('.insert(');
  });

  it('points carrier Return Journey navigation at the canonical fleet workspace', () => {
    expect(workflow).toContain("href: '/admin/fleet/returns'");
    expect(modules).toContain("router.push('/admin/fleet/returns')");
    expect(workflow).not.toContain("href: '/admin/returns'");
    expect(modules).not.toContain("router.push('/admin/returns')");
  });
});
