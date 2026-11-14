const fs=require('fs'),cp=require('child_process');
const read=p=>fs.readFileSync(p,'utf8');
const page=read('app/driver/finance/page.tsx');
const css=read('app/components/workspace/InvoiceProFinance.module.css');
const main=cp.execFileSync('git',['show','origin/main:app/driver/finance/page.tsx'],{encoding:'utf8'}).replaceAll('\r\n','\n');
const normalized=page.replaceAll('\r\n','\n')
 .replace("import { resolveWorkspaceRole } from '../../../lib/workspaceRole';\n",'')
 .replace("  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';\n",'')
 .replace(' data-owner-finance={isOwnerDriver ? "true" : undefined}','');
const checks=[
 ['Original finance logic exact except owner attribute',normalized===main],
 ['Finance styles only activate for Owner Driver',css.includes('.surface[data-owner-finance="true"]')&&!css.includes('.surface[data-owner-finance="false"]')],
 ['Owner finances remain routed through approved Invoice Pro',page.includes('<InvoiceProSurface')&&page.includes('<InvoiceProMasterTabs')],
 ['Draft invoice requires explicit review and send',page.includes('/edit')&&page.includes('Draft creation must be distinct from the explicit review and Send action.')],
 ['Ready to invoice only includes uninvoiced jobs',page.includes('const uninvoicedJobs = useMemo(() => eligibleJobs.filter((job) => !job.invoice)')],
 ['Awaiting payment filter stays payment-scoped',page.includes("activeTab === 'AwaitingPayment'")],
 ['Customer accounting excludes draft/cancelled',page.includes("invoice.status !== 'Draft' && invoice.status !== 'Cancelled'")],
 ['No direct send invoice API added',!page.includes('sendGeneratedInvoice(')],
 ['Post Load unchanged',!cp.execFileSync('git',['diff','--name-only','origin/main','--','app/driver/post-load','app/admin/post-load'],{encoding:'utf8'}).trim()],
];
for(const [n,ok] of checks)console.log((ok?'PASS':'FAIL')+' '+n);
if(checks.some(([,ok])=>!ok))process.exitCode=1;
