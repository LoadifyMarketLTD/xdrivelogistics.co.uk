const fs=require('fs');
const p='app/components/workspace/LegalAgreementsPage.tsx';
let src=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
function once(a,b){let n=src.split(a).length-1;if(n!==1)throw Error('Expected marker once: '+a.slice(0,80)+' count '+n);src=src.replace(a,b)}
once(`                    {record.signedPdfAvailable ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                        <ActionButton tone="primary" disabled={openingOriginalId === record.id} onClick={() => void openOriginalSignedAgreement(record)}>
                          {openingOriginalId === record.id ? 'Opening original...' : 'View original signed PDF'}
                        </ActionButton>
                        <ActionButton tone="secondary" disabled={downloadingId === record.id} onClick={() => void downloadSignedAgreement(record)}>
                          {downloadingId === record.id ? 'Preparing PDF...' : 'Download readable reconstruction'}
                        </ActionButton>
                      </div>
                    ) : null}`,
`                    {record.signedPdfAvailable ? (
                      <div style={{ display: 'grid', gap: 9, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                        <div style={{ color: '#4b5e78', fontSize: 12, lineHeight: 1.6 }}>
                          <strong>Readable legal text:</strong> download a fresh Unicode PDF reconstructed from the acceptance evidence.
                          The archived signed PDF is kept unchanged for integrity; some historical PDF files may have unreadable font encoding.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                          <ActionButton tone="primary" disabled={downloadingId === record.id} onClick={() => void downloadSignedAgreement(record)}>
                            {downloadingId === record.id ? 'Generating readable PDF...' : 'Download readable legal PDF'}
                          </ActionButton>
                          <ActionButton tone="secondary" disabled={openingOriginalId === record.id} onClick={() => void openOriginalSignedAgreement(record)}>
                            {openingOriginalId === record.id ? 'Opening archive...' : 'View archived signed original'}
                          </ActionButton>
                        </div>
                      </div>
                    ) : null}`);
fs.writeFileSync(p,src,'utf8');
console.log('Legal history now foregrounds fresh readable Unicode PDF while retaining immutable original archive.');
