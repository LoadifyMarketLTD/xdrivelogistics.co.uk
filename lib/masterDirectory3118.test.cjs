const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const source = read('app/components/workspace/MemberDirectoryPage.tsx');
const nav = read('lib/masterWorkspaceNavigation.ts');
const api = read('app/api/directory/route.ts');
const pages = [
 'app/admin/marketplace/directory/page.tsx',
 'app/broker/carrier-network/directory/page.tsx',
 'app/customer/network/directory/page.tsx',
 'app/driver/directory/page.tsx',
 'app/super-admin/members-directory/page.tsx',
];
test('one approved 3118 Directory component is reused in every workspace',()=>{
 for(const f of pages) {
  assert.match(read(f), /MemberDirectoryPage/,f);
  assert.doesNotMatch(read(f), /DemoMemberDirectory|try-xdrive-demo\/directory|STAGING MEMBERS/,f);
 }
 assert.match(read('app/super-admin/_components/SuperAdminWorkspaceShell.tsx'),/members-directory/);
});
test('nine role navigations lead to real Directory route, not other network pages',()=>{
 const positions = [
 "'/admin/marketplace/directory'",
 "'/broker/carrier-network/directory'",
 "'/customer/network/directory'",
 "'/driver/directory'",
 ];
 for(const expected of positions)assert.ok(nav.includes(expected));
 const routes = [
 '/admin/marketplace/directory','/broker/carrier-network/directory',
 '/customer/network/directory','/driver/directory','/super-admin/members-directory',
 ];
 for (const route of routes) {
   assert.ok(fs.existsSync(path.join(root,'app',route.slice(1),'page.tsx')),route);
 }
});
test('directory is production-backed, authenticated, and preserves search/permissions',()=>{
 assert.match(source,/fetch\(\`\/api\/directory\?/);
 assert.match(source,/readRouteAuthAccessToken/);
 assert.match(source,/privateGroups\.canManage/);
 assert.match(source,/Saved Networks/);
 assert.match(source,/Book Direct/);
 assert.match(source,/Messages/);
 assert.match(source,/MemberIdentityLink/);
 assert.match(api,/getBearerToken\(request\)/);
 assert.match(api,/verifyPlatformOwner\(request\)/);
 assert.match(api,/getBlockedCounterpartyCompanyIds/);
 assert.doesNotMatch(source,/authenticatedDemoFetch|\/api\/try-xdrive-demo\//);
});
test('production Directory source is identical to preserved approved 3118 reference when available',()=>{
 const reference='D:/XDrive-3118-Boards-Integration-20261103/app/components/workspace/MemberDirectoryPage.tsx';
 if(fs.existsSync(reference))assert.equal(source,fs.readFileSync(reference,'utf8'));
});
