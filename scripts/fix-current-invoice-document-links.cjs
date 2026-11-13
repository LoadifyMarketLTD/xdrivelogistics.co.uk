const fs=require('node:fs');
const file='app/driver/finance/invoices/[id]/page.tsx';
let text=fs.readFileSync(file,'utf8');
const exact=(a,b)=>{const count=text.split(a).length-1;if(count!==1)throw Error('Expected one '+a.slice(0,65)+'; got '+count);text=text.replace(a,b);};
exact("const [documents, setDocuments] = useState<DocumentRecord[]>([]);","const [documents, setDocuments] = useState<DocumentRecord[]>([]);\n  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);");
const anchor='  const handleRecordPayment = async () => {';
const helper=`
  // Invoice document paths are private storage keys, never browser addresses.
  // The authorised invoice-document service issues a short-lived signed URL.
  const openInvoiceDocument = async (document: DocumentRecord) => {
    if (!invoiceId) return;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setOpeningDocumentId(document.id);
    setDocError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expired. Please sign in again.');
      const query = new URLSearchParams({ invoiceId, documentId: document.id });
      const response = await fetch('/api/finance/invoice-document-url?' + query.toString(), {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { signedUrl?: string; error?: string };
      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error || 'This document could not be opened securely.');
      }
      if (popup) popup.location.href = payload.signedUrl;
      else window.location.assign(payload.signedUrl);
    } catch (reason) {
      popup?.close();
      setDocError(reason instanceof Error ? reason.message : 'Document could not be opened.');
    } finally {
      setOpeningDocumentId(null);
    }
  };

`;
exact(anchor,helper+anchor);
exact('<a href={document.file_url} target="_blank" rel="noopener noreferrer">{document.file_name ?? \'Document\'}</a>',
'<ActionButton tone="secondary" disabled={openingDocumentId===document.id} onClick={()=>void openInvoiceDocument(document)}>{openingDocumentId===document.id?\'Opening...\':document.file_name??\'View document\'}</ActionButton>');
const listMarker='<div className="driver-detail-tabs"><strong>Documents</strong><ActionButton';
exact(listMarker,'<div className="driver-detail-tabs"><strong>Documents</strong>{docError && <span role="alert" className="driver-diary-text-block">{docError}</span>}<ActionButton');
fs.writeFileSync(file,text,'utf8');
console.log('Invoice document links now use the current authenticated signed URL endpoint.');
