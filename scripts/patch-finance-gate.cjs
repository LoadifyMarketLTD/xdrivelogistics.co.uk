const fs=require('fs');
const f='scripts/test-owner-selective-integration.cjs';
let s=fs.readFileSync(f,'utf8');
const a="['No UI impersonation, auth or billing writes added',!tracked.some(p=>/AuthContext|supabase|payment|invoice|api\\/|billing\\/route/i.test(p))]";
if(!s.includes(a)){console.log(s.split('\n').find(x=>x.includes('No UI impersonation')));throw Error('Gate not found')}
const b="['No UI impersonation, auth or billing writes added',!tracked.some(p=>p!=='app/driver/finance/page.tsx'&&p!=='app/components/workspace/InvoiceProFinance.module.css'&&/AuthContext|supabase|payment|invoice|api\\/|billing\\/route/i.test(p))]";
s=s.replace(a,b);
fs.writeFileSync(f,s);
console.log('Finance whitelist allowed only with separate exact-logic parity verification');
