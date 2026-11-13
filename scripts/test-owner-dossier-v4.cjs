const fs=require('node:fs');
const cp=require('node:child_process');
const dossier=fs.readFileSync('app/components/workspace/DriverJobExecutionPage.tsx','utf8');
const jobs=fs.readFileSync('app/driver/jobs/page.tsx','utf8');
const css=fs.readFileSync('app/driver/xdrive-job-dossier-v4.css','utf8');
const before=cp.execFileSync('git',['show','HEAD:app/components/workspace/DriverJobExecutionPage.tsx'],{encoding:'utf8'});
const checks=[
 ['7 separate dossier tabs', ['overview','order','tracking','pod','documents','invoice','history'].every(id=>dossier.includes("['"+id+"','"))],
 ['Tab access and active selection',dossier.includes('role="tablist"')&&dossier.includes('aria-selected={caseTab===id}')&&dossier.includes('onClick={()=>setCaseTab(id)}')],
 ['Overview route, vehicle and POD/invoice status',dossier.includes('xd-case-overview__grid')&&dossier.includes('sheet?.invoices[0]?.number')&&dossier.includes('podComplete')],
 ['Order visible only in Order tab',dossier.includes("{caseTab==='order' && <>")],
 ['Journey Replay visible only on Tracking tab',dossier.includes("caseTab==='tracking' && <div id=\"journey-replay\"")],
 ['POD form and existing evidence handlers retained',dossier.includes("caseTab==='pod' && (currentStatus === 'on_site_delivery'")&&dossier.includes('onClick={() => void completePod()}')&&dossier.includes('onChange={selectDeliveryPhotos}')],
 ['History and documents split',dossier.includes("caseTab==='history' && <Panel title=\"Operational timeline\"")&&dossier.includes("caseTab==='documents' && <Panel title=\"Documents\"")],
 ['Invoice status and payment status separated',dossier.includes('PAYMENT STATUS')&&dossier.includes('INVOICE STATUS')&&dossier.includes('sheet?.invoices[0]?.paymentStatus')],
 ['Invoice create/view actions preserved',dossier.includes('onClick={()=>void createInvoice()}')&&dossier.includes('View Invoice')],
 ['Driver-only card anatomy reused in My Jobs',jobs.includes('<XDriveTransportOverview')&&jobs.includes('tone="diary"')],
 ['No duplicate My Jobs page heading',jobs.includes('hideHeader')&&!jobs.includes('<DriverIntegratedNav')],
 ['Mobile/PWA branch unaffected',(()=>{
    const a='  if (mobilePwa) {',b='  return (\n    <PageFrame>';
    const as=before.indexOf(a),bs=before.indexOf(b,as+1);
    const ax=dossier.indexOf(a),bx=dossier.indexOf(b,ax+1);
    return as>=0&&bs>as&&ax>=0&&bx>ax&&before.slice(as,bs)===dossier.slice(ax,bx);
 })()],
 ['V4 CSS exists and is scoped',css.includes('.xdrive-driver-workspace .xd-case-dossier')&&css.includes('.xd-case-overview__grid')]
];
for(const [name,ok] of checks)console.log((ok?'PASS':'FAIL')+' '+name);
if(checks.some(x=>!x[1]))process.exit(1);
