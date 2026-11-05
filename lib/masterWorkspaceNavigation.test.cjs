const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'lib/masterWorkspaceNavigation.ts'),'utf8');
const production=fs.readFileSync(path.join(root,'app/components/workspace/AuthenticatedMasterShell.tsx'),'utf8');
const sidebar=fs.readFileSync(path.join(root,'app/try-xdrive-demo/components/ApprovedSidebar.tsx'),'utf8');
test('authenticated master navigation changes Next route rather than rendering demo tab',()=>{
 assert.match(production,/masterNavigationHref\(role,index\)/);
 assert.match(production,/router\.push\(target\)/);
 assert.match(production,/data-master-workspace="production"/);
 assert.match(sidebar,/disabledIndices\.includes\(i\)/);
});
test('all declared Master navigation paths exist as pages and do not cross role domains',()=>{
 const matches=[...code.matchAll(/(?:'(Company \/ Carrier|Company Driver|Employee Driver|Owner Driver)'|(Broker|Customer|Driver|Fleet|Dispatcher)):\s*\[([\s\S]*?)\]/g)];
 assert.equal(matches.length,9);
 let paths=0;
 for(const [,quotedRole,plainRole,body] of matches){
  const role=quotedRole||plainRole;
  const entries=body.match(/'\/[^']*'|null/g)||[];
  assert.equal(entries.length,17,role+' must preserve common Master navigation shape');
  for(const item of entries){
   if(item==='null')continue;
   const href=item.slice(1,-1);
   const pathname=path.join(root,'app',href.slice(1),'page.tsx');
   assert.ok(fs.existsSync(pathname),role+': missing operational page '+href);
   const allowed=role==='Broker'?'/broker':role==='Customer'?'/customer':['Driver','Company Driver','Employee Driver','Owner Driver'].includes(role)?'/driver':'/admin';
   assert.ok(href===allowed||href.startsWith(allowed+'/'),role+': cross-role route '+href);
   paths++;
  }
 }
 assert.ok(paths>70);
});
