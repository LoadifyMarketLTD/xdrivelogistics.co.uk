const fs=require('fs');
const file='app/components/workspace/DriverJobExecutionPage.tsx';let x=fs.readFileSync(file,'utf8');
function one(a,b){const n=x.split(a).length-1;if(n!==1)throw Error('Expected 1 match got '+n+' for '+a.slice(0,85));x=x.replace(a,b)}
const podLine='<ActionButton tone="secondary" onClick={() => {setCaseTab(\'pod\');void openPodDetails();}}>View POD</ActionButton>';
const idx=x.indexOf("{caseTab==='pod' && <Panel title=\"POD and invoice\"");
const podStart=x.indexOf(podLine,idx);
if(idx<0||podStart<0)throw Error('POD section marker absent');
x=x.slice(0,podStart)+x.slice(podStart).replace(podLine,`<ActionButton tone="secondary" onClick={() => {setCaseTab('pod');void openPodDetails();}}>POD details</ActionButton>
              <ActionButton tone="primary" disabled={working} onClick={() => void viewPodPdf()}>View official POD PDF</ActionButton>
              <ActionButton tone="secondary" disabled={working} onClick={() => void downloadPodPdf()}>Download official POD PDF</ActionButton>`);
const invoiceLine=`{sheet?.invoices[0]?.id ? <ActionButton tone="primary" onClick={()=>router.push(\`/driver/finance/invoices/\${sheet.invoices[0].id}\`)}>View Invoice</ActionButton> :`;
if(!x.includes(invoiceLine))throw Error('Invoice CTA marker missing');
x=x.replace(invoiceLine,`{sheet?.invoices[0]?.id ? <>
                <ActionButton tone="primary" disabled={working} onClick={()=>void openInvoicePreview(sheet.invoices[0].id!)}>Preview official Invoice PDF</ActionButton>
                <ActionButton tone="secondary" onClick={()=>router.push(\`/driver/finance/invoices/\${sheet.invoices[0].id}\`)}>Invoice details &amp; payment</ActionButton>
              </> :`);
one('<button type="button" onClick={()=>setCaseTab(\'pod\')}>{podComplete ? \'View POD\' : \'Complete POD\'}</button>',
    '<button type="button" onClick={()=>{setCaseTab(\'pod\');if(podComplete)void openPodDetails();}}>{podComplete ? \'POD & evidence\' : \'Complete POD\'}</button>');
fs.writeFileSync(file,x,'utf8');
console.log('POD/Invoice tabs now expose current official PDF generators, with document and payment actions separate');
