const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
// Convert matching Inter Latin subsets to real TTFs using the project's existing verified converter.
let conv=fs.readFileSync(path.join(root,'scripts/convert-legal-woff-to-ttf.cjs'),'utf8').replaceAll(String.fromCharCode(13,10),String.fromCharCode(10));
const old="for (const weight of [400, 700]) {\n  convert(path.join(base, `inter-latin-ext-${weight}-normal.woff`), path.join(dest, `inter-latin-ext-${weight}-normal.ttf`));\n}";
const next="for (const subset of ['latin', 'latin-ext']) {\n  for (const weight of [400, 700]) {\n    convert(path.join(base, `inter-${subset}-${weight}-normal.woff`), path.join(dest, `inter-${subset}-${weight}-normal.ttf`));\n  }\n}";
if(!conv.includes(old))throw Error('Unknown font converter structure');
fs.writeFileSync(path.join(root,'scripts/convert-legal-woff-to-ttf.cjs'),conv.replace(old,next),'utf8');
const file=path.join(root,'lib/legal/signedAgreementPdf.ts');let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const start=s.indexOf('const loadInterFonts = async (pdf: PDFDocument) => {');
const end=s.indexOf('\nexport const buildSignedLegalAgreementPdf',start);
if(start<0||end<start)throw Error('Cannot locate complete font renderer block');
const renderer=`const loadInterFonts = async (pdf: PDFDocument) => {
  pdf.registerFontkit(fontkit);
  // Each @fontsource Inter subset is INCOMPLETE alone: latin-ext lacks ordinary
  // English letters, so the old generator silently drew .notdef squares.
  // Embed both open-source Unicode subsets and select per character.
  const base = join(process.cwd(), 'public', 'fonts', 'legal');
  const [latinRegularBytes, latinBoldBytes, extRegularBytes, extBoldBytes] = await Promise.all([
    readFile(join(base,'inter-latin-400-normal.ttf')),
    readFile(join(base,'inter-latin-700-normal.ttf')),
    readFile(join(base,'inter-latin-ext-400-normal.ttf')),
    readFile(join(base,'inter-latin-ext-700-normal.ttf')),
  ]);
  const [regular, bold, extRegular, extBold] = await Promise.all([
    pdf.embedFont(latinRegularBytes,{subset:false}),
    pdf.embedFont(latinBoldBytes,{subset:false}),
    pdf.embedFont(extRegularBytes,{subset:false}),
    pdf.embedFont(extBoldBytes,{subset:false}),
  ]);
  const latinRegular = fontkit.create(latinRegularBytes);
  const latinBold = fontkit.create(latinBoldBytes);
  const extendedRegular = fontkit.create(extRegularBytes);
  const extendedBold = fontkit.create(extBoldBytes);
  const select = (char:string,isBold:boolean):PDFFont => {
    const cp=char.codePointAt(0)!;
    if ((isBold?latinBold:latinRegular).hasGlyphForCodePoint(cp)) return isBold?bold:regular;
    if ((isBold?extendedBold:extendedRegular).hasGlyphForCodePoint(cp)) return isBold?extBold:extRegular;
    throw new Error('Legal PDF font does not support Unicode U+'+cp.toString(16).toUpperCase().padStart(4,'0'));
  };
  return { select };
};

const fontRuns=(value:string,bold:boolean,select:(char:string,bold:boolean)=>PDFFont)=>{
  const runs:Array<{font:PDFFont; text:string}>=[];
  for(const char of value){
    const font=select(char,bold);
    const last=runs[runs.length-1];
    if(last && last.font===font)last.text+=char;
    else runs.push({font,text:char});
  }
  return runs;
};
const textWidth=(value:string,size:number,bold:boolean,select:(char:string,bold:boolean)=>PDFFont)=>
  fontRuns(value,bold,select).reduce((sum,{font,text})=>sum+font.widthOfTextAtSize(text,size),0);

const wrapText = (
  text: string, size:number, maxWidth:number,bold:boolean,
  select:(char:string,bold:boolean)=>PDFFont,
) => {
  const paragraphs=text.replace(/\\r/g,'').split('\\n');
  const lines:string[]=[];
  for(const paragraph of paragraphs){
    if(!paragraph.trim()){lines.push('');continue;}
    const words=paragraph.split(/\\s+/);
    let line='';
    for(const word of words){
      const candidate=line?line+' '+word:word;
      if(textWidth(candidate,size,bold,select)<=maxWidth){line=candidate;continue;}
      if(line)lines.push(line);
      if(textWidth(word,size,bold,select)<=maxWidth){line=word;continue;}
      let chunk='';
      for(const char of word){
        const next=chunk+char;
        if(textWidth(next,size,bold,select)>maxWidth && chunk){lines.push(chunk);chunk=char;}
        else chunk=next;
      }
      line=chunk;
    }
    if(line)lines.push(line);
  }
  return lines;
};
const addWriter=(pdf:PDFDocument,select:(char:string,bold:boolean)=>PDFFont)=>{
  let page:PDFPage=pdf.addPage(A4);
  let y=A4[1]-MARGIN;
  const ensure=(height:number)=>{
    if(y-height>=MARGIN)return;
    page=pdf.addPage(A4);y=A4[1]-MARGIN;
  };
  const line=(value:string,opts?:{size?:number;bold?:boolean;color?:ReturnType<typeof rgb>;gap?:number})=>{
    const size=opts?.size??9.5,isBold=!!opts?.bold,color=opts?.color??DARK;
    const lines=wrapText(value,size,CONTENT_WIDTH,isBold,select);
    const lineHeight=size*1.45;
    ensure(Math.max(lineHeight,lines.length*lineHeight)+(opts?.gap??0));
    for(const item of lines){
      let x=MARGIN;
      if(!item){y-=lineHeight;continue;}
      for(const run of fontRuns(item,isBold,select)){
        page.drawText(run.text,{x,y,size,font:run.font,color});
        x+=run.font.widthOfTextAtSize(run.text,size);
      }
      y-=lineHeight;
    }
    y-=opts?.gap??0;
  };
  const spacer=(height=8)=>{ensure(height);y-=height;};
  const rule=()=>{
    ensure(10);
    page.drawLine({start:{x:MARGIN,y},end:{x:A4[0]-MARGIN,y},thickness:.8,color:rgb(.84,.87,.91)});
    y-=12;
  };
  return {line,spacer,rule};
};
`;
s=s.slice(0,start)+renderer+s.slice(end);
if(!s.includes('const { regular, bold } = await loadInterFonts(pdf);'))throw Error('Caller marker missing');
s=s.replace('const { regular, bold } = await loadInterFonts(pdf);','const { select } = await loadInterFonts(pdf);');
s=s.replace('const w = addWriter(pdf, regular, bold);','const w = addWriter(pdf, select);');
fs.writeFileSync(file,s,'utf8');
console.log('Legal font writer now explicitly selects supported glyph font for every character');
