const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const tests=[
 ['Authenticating driver layout remains protected',()=>{
   const s=read('app/driver/layout.tsx');
   assert.match(s,/ProtectedRoute allowedRoles=\{\['driver', 'company_admin', 'company_staff'\]\}/);
 }],
 ['Preserved Post Load dedicated shell and route',()=>{
   const s=read('app/driver/DriverMasterLayoutGate.tsx');
   assert.match(s,/section==='post-load'/);
   assert.match(s,/return <MasterWorkspace key=\{pathname\}/);
 }],
 ['PR807 top navigation restored for non-Post-Load driver screens',()=>{
   const s=read('app/driver/DriverMasterLayoutGate.tsx');
   assert.match(s,/return <DriverTopWorkspaceShell>\{children\}<\/DriverTopWorkspaceShell>/);
   assert.doesNotMatch(s,/return <AuthenticatedMasterShell/);
 }],
 ['Owner Driver real dashboard restored, no 3150 dashboard substitution',()=>{
   const s=read('app/driver/page.tsx');
   assert.match(s,/export default function DriverDashboard\(\)/);
   assert.match(s,/xd-owner-commercial-dashboard/);
   assert.match(s,/Reports & Statistics/);
   assert.doesNotMatch(s,/OwnerDriver3150LiveDashboard/);
 }],
 ['Loads and Quotes use recovered own PR807 cards; retain modern state handlers',()=>{
   const l=read('app/driver/loads/page.tsx');
   const q=read('app/driver/quotes/page.tsx');
   assert.match(l,/OwnerPR807LoadCard/);
   assert.match(l,/usePublicPickupRadius/);
   assert.match(q,/OwnerPR807QuoteCard/);
   assert.match(q,/fetchAllBookingOfferPages/);
   assert.match(q,/pendingBookingOffer/);
 }],
 ['Diary uses recovered PR807 presentation and keeps POD transaction rules',()=>{
   const s=read('app/driver/history/page.tsx');
   assert.match(s,/OwnerPR807DiaryCard/);
   assert.match(s,/isDeliveredAwaitingPod/);
   assert.match(s,/Booking Details/);
   assert.match(s,/CxDiaryActions/);
 }],
 ['XDrive own original context card is present',()=>{
   assert.match(read('app/components/workspace/XDriveCardContext.tsx'),/Freight|XDrive ref|xd-card-context/);
 }],
 ['No source changes to authentication, APIs, financial documents, Post Load or PWA',()=>{
   const changed=execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
   for(const p of changed){
     assert.ok(!/^app\/api\//.test(p),'API modified: '+p);
     assert.ok(!/^app\/driver\/post-load\//.test(p),'Post Load modified: '+p);
     assert.ok(!/^driver-pwa-reserve\//.test(p),'Driver PWA modified: '+p);
     assert.ok(!/^app\/components\/AuthContext/.test(p),'Auth modified: '+p);
   }
 }],
];
let passes=0;
for(const [name,fn] of tests){
 try{fn();console.log('PASS '+name);passes++;}
 catch(e){console.error('FAIL '+name+': '+e.message);}
}
console.log('RECOVERY_CONTRACT '+passes+'/'+tests.length);
if(passes!==tests.length)process.exitCode=1;
