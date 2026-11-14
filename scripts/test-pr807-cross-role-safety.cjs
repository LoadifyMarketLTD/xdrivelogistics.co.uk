const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let failed=0;
function check(name,ok){console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failed++;}
const roleRoutes=[
 'app/customer/loads/page.tsx',
 'app/broker/loads/page.tsx',
 'app/admin/page.tsx',
 'app/try-xdrive-fleet-demo/page.tsx',
 'app/try-xdrive-dispatcher-demo/page.tsx',
 'app/driver/jobs/page.tsx',
 'app/try-xdrive-company-driver-demo/page.tsx'
];
check('Seven workspace entry points retained',roleRoutes.every(f=>fs.existsSync(path.join(root,f))));
const master=read('app/components/workspace/Master3150Card.tsx');
check('New 807 presentation variant exists',master.includes("presentation === 'xdrive807'"));
check('Original 3150 variant remains available',master.includes("presentation='approved3150'"));
const cards=['CxLoadCard','CxQuoteCard','CxDiaryCard'];
check('Shared Loads Quotes Diary opt into 807',cards.every(c=>read('app/components/workspace/'+c+'.tsx').includes('presentation="xdrive807"')));
const legacy=read('app/try-xdrive-demo/components/XDriveLoadCard.tsx');
check('Historical seven-role board cards use 807',legacy.includes('data-presentation="xdrive807"'));
check('Original View Details callback preserved',legacy.includes('onClick={onDetails}'));
check('Original role action handlers preserved',legacy.includes('{actions}'));
check('Original role extension details preserved',legacy.includes('{extra}'));
check('Invoice and POD APIs left unchanged in current stage',
 !cp.execFileSync('git',['diff','origin/main','--name-only'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).some(p=>/^app\/api\//.test(p)));
const changed=cp.execFileSync('git',['diff','origin/main','--name-only'],{cwd:root,encoding:'utf8'}).split(/\r?\n/);
check('Post Load files protected',!changed.some(p=>/post-load|postLoad|LoadPostingForm|app\/api\/jobs\/create/i.test(p)));
check('Driver PWA files protected',!changed.some(p=>/official-pwa|apps\/driver-mobile|android-native|public\/driver/i.test(p)));
check('No authentication or RLS writes introduced',!changed.some(p=>/middleware|supabase|\/auth\/|\/rls\//i.test(p)));
console.log('Cross-role static checks:',12-failed,'/12 PASS');
process.exit(failed?1:0);
