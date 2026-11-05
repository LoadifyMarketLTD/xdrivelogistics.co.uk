const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('admin jobs uses master cards preserving canonical operational actions',()=>{
 const page=read('app/admin/jobs/page.tsx');
 const component=read('app/components/workspace/JobsOperationalTable.tsx');
 assert.match(page,/<JobsOperationalTable\s+cardLayout/);
 assert.match(page,/router.push\('\/admin\/post-load'\)/);
 assert.match(page,/onViewJob=\{\(id\) => router.push/);
 assert.match(page,/onDirectInvite=/);
 assert.match(page,/onStatusChange=/);
 assert.match(component,/cardLayout && totalFiltered > perPage/);
 assert.match(component,/allowedStatusTransitions\(job.status\)/);
 assert.match(component,/isDirectInviteEligible\(job\)/);
 assert.match(component,/master-jobs-card-layout/);
});
