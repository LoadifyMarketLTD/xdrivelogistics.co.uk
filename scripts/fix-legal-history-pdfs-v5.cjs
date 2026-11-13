const fs=require('node:fs');const p='app/components/workspace/LegalAgreementsPage.tsx';let s=fs.readFileSync(p,'utf8').replaceAll(String.fromCharCode(13,10),String.fromCharCode(10));function replace(a,b){let n=s.split(a).length-1;if(n!==1)throw Error('Expected one marker '+a.slice(0,60)+' got '+n);s=s.replace(a,b)}
replace('  const [downloadingId, setDownloadingId] = useState<string | null>(null);','  const [downloadingId, setDownloadingId] = useState<string | null>(null);\n  const [openingOriginalId, setOpeningOriginalId] = useState<string | null>(null);');
const before='  const submitAcceptance = async () => {';
const added=`  // Original signed PDF is accessed read-only via a short-lived signed storage URL.
  // This is distinct from the explicitly labelled readable reconstruction.
  const openOriginalSignedAgreement = async (record: AcceptanceHistoryRow) => {
    if (!record.signedPdfAvailable) return;
    const viewer = window.open('about:blank', '_blank');
    if (viewer) viewer.opener = null;
    setOpeningOriginalId(record.id);
    setError('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/account/legal-agreements/' + encodeURIComponent(record.id) + '/signed-document', {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Original signed PDF could not be opened.');
      if (viewer) viewer.location.href = payload.url;
      else window.location.assign(payload.url);
    } catch (cause) {
      viewer?.close();
      setError(cause instanceof Error ? cause.message : 'Original signed PDF could not be opened.');
    } finally {
      setOpeningOriginalId(null);
    }
  };

`;
replace(before,added+before);
replace('<span> Â· v{agreement.version}{agreement.language ? ` Â· ${agreement.language}` : \'\'}</span>','<span> | v{agreement.version}{agreement.language ? ` | ${agreement.language}` : \'\'}</span>');
s=s.replaceAll('â€¦','...');
const original=`<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton tone="secondary" disabled={downloadingId === record.id} onClick={() => void downloadSignedAgreement(record)}>
                          {downloadingId === record.id ? 'Preparing PDF...' : 'Download readable copy'}
                        </ActionButton>
                      </div>`;
if(!s.includes(original)){const m=s.indexOf('onClick={() => void downloadSignedAgreement(record)}'); console.log('MARKER',JSON.stringify(s.slice(m-140,m+210)));throw Error('Legal actions marker missing')}
s=s.replace(original,`<div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                        <ActionButton tone="primary" disabled={openingOriginalId === record.id} onClick={() => void openOriginalSignedAgreement(record)}>
                          {openingOriginalId === record.id ? 'Opening original...' : 'View original signed PDF'}
                        </ActionButton>
                        <ActionButton tone="secondary" disabled={downloadingId === record.id} onClick={() => void downloadSignedAgreement(record)}>
                          {downloadingId === record.id ? 'Preparing PDF...' : 'Download readable reconstruction'}
                        </ActionButton>
                      </div>`);
fs.writeFileSync(p,s,'utf8');console.log('Fixed legal history encoding, distinguished original signed PDF from reconstruction');
