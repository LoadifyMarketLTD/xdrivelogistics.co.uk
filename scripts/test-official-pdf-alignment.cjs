const fs=require('node:fs');
const cp=require('node:child_process');
const files=[
'lib/server/professionalPodPdf.ts',
'lib/server/officialXDrivePdfLogo.ts',
'lib/server/invoicePdf.ts',
'lib/server/invoicePdfContext.ts',
'lib/server/podEvidenceClassification.ts',
'app/api/workspace/jobs/[jobId]/pod/pdf/route.ts',
'app/api/driver/finance/invoices/[id]/preview/route.ts'
];
const checks=[];
for(const f of files){
 const current=fs.readFileSync(f);
 const main=cp.execFileSync('git',['show','FETCH_HEAD:'+f],{maxBuffer:20*1024*1024});
 checks.push(['Current main generator preserved byte-for-byte: '+f,current.toString("utf8").replaceAll(String.fromCharCode(13,10),String.fromCharCode(10))===main.toString("utf8").replaceAll(String.fromCharCode(13,10),String.fromCharCode(10))]);
}
checks.push(['Official XDrive logo present',fs.existsSync('public/xdrive-logo-primary.png')]);
const dossier=fs.readFileSync('app/components/workspace/DriverJobExecutionPage.tsx','utf8');
checks.push(['POD opens official authenticated API',dossier.includes('View official POD PDF')&&dossier.includes('void viewPodPdf()')]);
checks.push(['POD downloads same official PDF',dossier.includes('Download official POD PDF')&&dossier.includes('void downloadPodPdf()')]);
checks.push(['Invoice preview uses current server PDF API',dossier.includes('Preview official Invoice PDF')&&dossier.includes('void openInvoicePreview(sheet.invoices[0].id!)')]);
const detail=fs.readFileSync('app/driver/finance/invoices/[id]/page.tsx','utf8');
checks.push(['No raw storage path exposed as href',!detail.includes('href={document.file_url}')]);
checks.push(['Invoice attachments use signed authorised link',detail.includes('/api/finance/invoice-document-url?')&&detail.includes('documentId: document.id')&&detail.includes('Authorization:')]);
for(const [label,yes] of checks)console.log((yes?'PASS':'FAIL')+' '+label);
if(checks.some(x=>!x[1]))process.exit(1);
