import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Company Admin Post Load — original 3150',()=>{
  it('uses exactly the original form and does not add a duplicate heading',()=>{
    const route=read('app/admin/post-load/page.tsx');
    const source=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
    expect(route).toContain('<LoadPostingForm mode="admin" />');
    expect(source).toContain('<LoadPostingForm mode={role==="Customer"');
    expect(route).not.toContain('PageHeader');
    expect(route).not.toContain('PageFrame');
  });
  it('preserves authenticated authorization and the existing real posting component',()=>{
    expect(read('app/admin/post-load/page.tsx')).toContain("allowedRoles={['owner', 'company_admin', 'company_staff']}");
    const form=read('app/components/workspace/LoadPostingForm.tsx');
    expect(form).toContain('approved-post-load-3150.css');
    expect(form).toContain('supabase');
  });
});