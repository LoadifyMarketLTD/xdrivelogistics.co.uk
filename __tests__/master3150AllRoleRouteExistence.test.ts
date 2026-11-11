import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {MASTER_AUTHENTICATED_ROUTES} from '../lib/masterWorkspaceNavigation';

describe('all Master 3150 authenticated role tab destinations',()=>{
 for(const [role,routes] of Object.entries(MASTER_AUTHENTICATED_ROUTES)){
  it(`${role} has no dead canonical tab destinations`,()=>{
   for(const href of routes){
    if(!href)continue;
    const segments=href.split('/').filter(Boolean);
    const base=path.join(process.cwd(),'app',...segments);
    expect(fs.existsSync(path.join(base,'page.tsx'))||fs.existsSync(path.join(base,'page.ts'))||fs.existsSync(path.join(base,'page.jsx')),`${role}: ${href} is missing a Next.js page`).toBe(true);
   }
  });
 }
});
