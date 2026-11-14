const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const {PDFDocument,PDFName,PDFDict}=require('pdf-lib');
const fontkit=require('@pdf-lib/fontkit');
const root=path.resolve(__dirname,'..');
(async()=>{
  // Ensure both font subset families provide all ordinary and Romanian glyphs.
  const messages=['Hello World','XDrive Logistics','Semnătură electronică','Șofer și companie','Țară România','Société française','Contrato español','Zaakceptowano'];
  for(const weight of [400,700]){
    const fs1=fontkit.create(fs.readFileSync(path.join(root,`public/fonts/legal/inter-latin-${weight}-normal.ttf`)));
    const fs2=fontkit.create(fs.readFileSync(path.join(root,`public/fonts/legal/inter-latin-ext-${weight}-normal.ttf`)));
    for(const message of messages){
      const misses=[...message].filter(ch=>!fs1.hasGlyphForCodePoint(ch.codePointAt(0))&&!fs2.hasGlyphForCodePoint(ch.codePointAt(0)));
      if(misses.length)throw Error('Missing '+weight+' glyph for '+JSON.stringify(message)+' '+JSON.stringify(misses));
    }
  }
  const tmp=path.join(root,'.xdrive-legal-font-smoke-test.cjs');
  try{
    await esbuild.build({entryPoints:[path.join(root,'lib/legal/signedAgreementPdf.ts'),path.join(root,'lib/legal/legalAgreementState.ts')],
      bundle:true,platform:'node',format:'cjs',packages:'external',outExtension:{'.js':' .cjs'.trim()},outdir:path.join(root,'.xdrive-legal-smoke-bundle'),logLevel:'error'});
    const generator=require(path.join(root,'.xdrive-legal-smoke-bundle','signedAgreementPdf.cjs'));
    const evidence=require(path.join(root,'.xdrive-legal-smoke-bundle','legalAgreementState.cjs'));
    for(const language of ['en','ro','fr','es','pl']){
      const data=evidence.buildCurrentLegalEvidence('owner_operator','2026-11-13T12:00:00.000Z',language);
      const output=await generator.buildSignedLegalAgreementPdf({
        acceptanceId:'00000000-0000-4000-8000-000000000001',signerFullName:'Test Signer',
        signerEmail:'test@example.invalid',companyName:'XDrive Test',evidence:data});
      const pdf=await PDFDocument.load(output.bytes);
      if(pdf.getPageCount()<2)throw Error('Unexpected PDF pages '+language);
      for(const [index,page] of pdf.getPages().entries()){
        const resources=page.node.Resources();
        const images=resources.lookup(PDFName.of('XObject'),PDFDict);
        if(!images || images.keys().length===0)throw Error('Missing official logo on '+language+' PDF page '+(index+1));
      }
      console.log('PASS '+language+' '+pdf.getPageCount()+' pages '+output.bytes.length+' bytes');
    }
  }finally{
    fs.rmSync(path.join(root,'.xdrive-legal-smoke-bundle'),{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
