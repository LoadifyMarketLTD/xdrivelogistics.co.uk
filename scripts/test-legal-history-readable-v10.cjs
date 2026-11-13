const fs=require('fs');
const legal=fs.readFileSync('app/components/workspace/LegalAgreementsPage.tsx','utf8');
const route=fs.readFileSync('app/api/account/legal-agreements/[id]/signed-document/route.ts','utf8');
const generator=fs.readFileSync('lib/legal/signedAgreementPdf.ts','utf8');
const checks=[
['Readable copy is the primary action',legal.includes('tone="primary" disabled={downloadingId === record.id}')&&legal.includes('Download readable legal PDF')],
['Archived original remains accessible as separate action',legal.includes('View archived signed original')&&legal.includes('openOriginalSignedAgreement(record)')],
['UI explicitly cautions that legacy signed PDFs may have damaged fonts',legal.includes('some historical PDF files may have unreadable font encoding')],
['No re-acceptance or signature from download',!legal.includes('onClick={() => void submitAcceptance(record)')&&route.includes('reproduction: true')],
['Server validates original SHA256 before reconstruction',route.includes('originalHash !== agreement.signed_pdf_hash')],
['Original signed file only served by immutable storage URL',route.includes('.createSignedUrl(agreement.signed_pdf_path, 120')],
['Readable file generated fresh from stored acceptance evidence',route.includes('buildSignedLegalAgreementPdf({')&&route.includes('evidence,')],
['Readable copy clearly labeled not original',route.includes('NOT THE ORIGINAL SIGNED PDF')],
['Font generator embeds full Latin and Latin extended subsets',generator.includes('inter-latin-400-normal.ttf')&&generator.includes('inter-latin-ext-400-normal.ttf')],
['Font generator selects per glyph and refuses missing codepoints',generator.includes('hasGlyphForCodePoint(cp)')&&generator.includes("Legal PDF font does not support Unicode U+")],
['Legal acceptance creation and version hash logic unchanged',legal.includes('submitAcceptance')&&route.includes('hash')&&generator.includes('hashControlledDocument')],
];
for(let [n,ok] of checks)console.log((ok?'PASS ':'FAIL ')+n);
if(checks.some(x=>!x[1]))process.exitCode=1;
