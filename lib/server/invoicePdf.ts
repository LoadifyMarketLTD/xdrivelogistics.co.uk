import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont } from 'pdf-lib';
import type { InvoiceVatTreatment } from '../invoiceVat';
import { drawOfficialXDrivePdfLogo } from './officialXDrivePdfLogo';

type InvoiceEvidenceImage = {
  bytes: Uint8Array;
  label?: string | null;
};

type InvoicePdfInput = {
  invoiceNumber: string;
  jobReference?: string | null;
  invoiceDate: string;
  dueDate: string;
  issuerName: string;
  issuerAddress?: string | null;
  issuerCompanyNumber?: string | null;
  issuerVatNumber?: string | null;
  issuerXdId?: string | null;
  issuerEmail?: string | null;
  issuerPhone?: string | null;
  issuerWebsite?: string | null;
  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  customerCompanyNumber?: string | null;
  customerVatNumber?: string | null;
  customerXdId?: string | null;
  customerReference?: string | null;
  loadId?: string | null;
  orderedAt?: string | null;
  leftAt?: string | null;
  deliveryNotes?: string | null;
  pickupLocation?: string | null;
  pickupDateTime?: string | null;
  deliveryLocation?: string | null;
  deliveryDateTime?: string | null;
  deliveredAt?: string | null;
  recipientName?: string | null;
  cargoDescription?: string | null;
  vehicleDescription?: string | null;
  serviceDescription?: string | null;
  bankAccountName?: string | null;
  bankSortCode?: string | null;
  bankAccountNumber?: string | null;
  paypalEmail?: string | null;
  logoBytes?: Uint8Array | null;
  evidenceImages?: InvoiceEvidenceImage[];
  signatureAttestation?: string | null;
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  vatTreatment?: InvoiceVatTreatment | null;
  totalAmount: number;
  currency: string;
  paymentTerms?: string | null;
};

const safeText = (value: string | null | undefined, fallback = '') =>
  value?.trim() || fallback;

const pdfText = (value: string | null | undefined, fallback = '') =>
  safeText(value, fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\u00A3\u00B7\u20AC]/g, '?');

const finiteMoney = (value: number) => Number.isFinite(value) ? value : 0;

const money = (value: number, currency: string) => {
  try {
    return pdfText(new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value));
  } catch {
    return `${value.toFixed(2)} ${pdfText(currency, 'GBP')}`;
  }
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '';
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) return pdfText(value);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return pdfText(value);
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  });
};

const wrapText = (text: string, maxChars = 70) => {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const fitText = (font: PDFFont, value: string, maxWidth: number, size: number, minSize = 6.5) => {
  let current = size;
  while (current > minSize && font.widthOfTextAtSize(value, current) > maxWidth) current -= 0.25;
  return current;
};

const wrapTextToWidth = (
  font: PDFFont,
  value: string,
  maxWidth: number,
  size: number,
  maxLines = Number.POSITIVE_INFINITY,
) => {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) break;
      current = word;
    } else {
      let chunk = '';
      for (const character of word) {
        const candidate = chunk + character;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && chunk) {
          lines.push(chunk);
          if (lines.length >= maxLines) break;
          chunk = character;
        } else {
          chunk = candidate;
        }
      }
      if (lines.length >= maxLines) break;
      current = chunk;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
    if (consumed < words.length) {
      let last = lines.at(-1) ?? '';
      while (last && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
        last = last.slice(0, -1).trimEnd();
      }
      lines[lines.length - 1] = `${last}...`;
    }
  }

  return lines;
};

const embedImage = async (pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> => {
  try {
    return await pdf.embedPng(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }
};

const fallbackVatTreatment = (input: InvoicePdfInput): InvoiceVatTreatment => {
  if (input.vatTreatment) return input.vatTreatment;
  if (input.vatRate === 20) return 'standard';
  if (input.vatRate === 5) return 'reduced';
  return input.issuerVatNumber ? 'zero_rated' : 'not_registered';
};

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(16 / 255, 36 / 255, 63 / 255);
  const slate = rgb(69 / 255, 82 / 255, 101 / 255);
  const muted = rgb(108 / 255, 119 / 255, 135 / 255);
  const border = rgb(218 / 255, 225 / 255, 232 / 255);
  const navy = rgb(10 / 255, 42 / 255, 78 / 255);
  const pale = rgb(247 / 255, 249 / 255, 252 / 255);
  const orange = rgb(242 / 255, 112 / 255, 27 / 255);
  const white = rgb(1, 1, 1);
  const pageWidth = 595.28, margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const issuerName = pdfText(input.issuerName, 'Invoice issuer');
  const vatTreatment = fallbackVatTreatment(input);
  const fit = (value: string, x: number, y: number, width: number, size = 9, strong = false, color = ink) => {
    const font = strong ? bold : regular;
    const s = pdfText(value);
    page.drawText(s, { x, y, font, size: fitText(font, s, width, size, 7), color });
  };
  const label = (value: string, x: number, y: number) => fit(value.toUpperCase(), x, y, 190, 7.2, true, muted);
  const wrapped = (value: string | null | undefined, x: number, y: number, width: number, maxLines = 2) => {
    const lines = wrapTextToWidth(regular, pdfText(value), width, 8.5, maxLines);
    lines.forEach((line, i) => fit(line, x, y - i * 12, width, 8.5, false, slate));
    return lines.length;
  };
  // Platform identity: official uploaded logo, no improvised substitute.
  page.drawRectangle({ x: 0, y: 825, width: pageWidth, height: 17, color: navy });
  page.drawRectangle({ x: 0, y: 820, width: pageWidth, height: 5, color: orange });
  await drawOfficialXDrivePdfLogo(pdf, page, { x: margin, y: 739, maxWidth: 210, maxHeight: 65 });
  fit('INVOICE', 380, 772, 175, 28, true, navy);
  page.drawRectangle({ x: 380, y: 755, width: 174, height: 3, color: orange });
  fit('FREIGHT TRANSPORT SERVICES', 381, 742, 173, 7.8, true, slate);
  // One aligned metadata strip.
  page.drawRectangle({ x: margin, y: 664, width: contentWidth, height: 63, color: pale, borderColor: border, borderWidth: .7 });
  const meta = [
    ['INVOICE NO.', pdfText(input.invoiceNumber, 'Invoice')],
    ['ISSUED', formatDate(input.invoiceDate)],
    ['DUE DATE', formatDate(input.dueDate)],
    ['JOB REF.', pdfText(input.jobReference || input.loadId, 'N/A')],
  ];
  [50, 181, 304, 423].forEach((x,i) => {
    label(meta[i][0],x,702);
    fit(meta[i][1],x,681,[126,116,113,119][i],i===0?10.4:9.4,true,navy);
  });
  // Two equal-height billing parties.
  const cardY=517,cardH=126,cardW=248,otherX=307;
  for(const x of [margin,otherX]){
    page.drawRectangle({x,y:cardY,width:cardW,height:cardH,color:white,borderColor:border,borderWidth:.8});
    page.drawRectangle({x,y:cardY+cardH-31,width:cardW,height:31,color:pale});
  }
  page.drawRectangle({x:margin,y:cardY+cardH-31,width:4,height:31,color:navy});
  page.drawRectangle({x:otherX,y:cardY+cardH-31,width:4,height:31,color:orange});
  fit('FROM / SERVICE PROVIDER',margin+14,cardY+cardH-20,218,8.3,true,navy);
  fit('BILL TO / CUSTOMER',otherX+14,cardY+cardH-20,217,8.3,true,navy);
  fit(issuerName,margin+13,cardY+cardH-52,222,11,true);
  fit(pdfText(input.clientName,'Customer'),otherX+13,cardY+cardH-52,222,11,true);
  const senderCount=wrapped(input.issuerAddress,margin+13,cardY+cardH-67,222);
  const clientCount=wrapped(input.clientAddress,otherX+13,cardY+cardH-67,222);
  const issuerExtra=[input.issuerCompanyNumber?'Company No. '+pdfText(input.issuerCompanyNumber):'',input.issuerVatNumber&&vatTreatment!=='not_registered'?'VAT No. '+pdfText(input.issuerVatNumber):'',pdfText(input.issuerEmail)].filter(Boolean);
  const clientExtra=[input.customerCompanyNumber?'Company No. '+pdfText(input.customerCompanyNumber):'',input.customerReference?'Customer Ref. '+pdfText(input.customerReference):'',pdfText(input.clientEmail)].filter(Boolean);
  issuerExtra.slice(0,2).forEach((v,i)=>fit(v,margin+13,cardY+cardH-67-senderCount*12-i*11,222,7.6,false,muted));
  clientExtra.slice(0,2).forEach((v,i)=>fit(v,otherX+13,cardY+cardH-67-clientCount*12-i*11,222,7.6,false,muted));
  // Collection and delivery positions.
  fit('TRANSPORT ROUTE',margin,498,220,9.5,true,navy);
  page.drawLine({start:{x:margin,y:489},end:{x:555,y:489},color:border,thickness:1});
  label('COLLECTION',margin,473); label('DELIVERY',otherX,473);
  wrapped(input.pickupLocation,margin,456,232);
  wrapped(input.deliveryLocation,otherX,456,232);
  // Commercial service item.
  const tableTop=416;
  page.drawRectangle({x:margin,y:tableTop-29,width:contentWidth,height:29,color:navy});
  fit('QTY',margin+11,tableTop-19,36,8.5,true,white);
  fit('SERVICE DESCRIPTION',margin+58,tableTop-19,295,8.5,true,white);
  fit('AMOUNT',464,tableTop-19,75,8.5,true,white);
  page.drawRectangle({x:margin,y:tableTop-155,width:contentWidth,height:126,color:white,borderColor:border,borderWidth:.8});
  page.drawRectangle({x:margin,y:tableTop-155,width:4,height:126,color:orange});
  fit('1',margin+16,tableTop-54,30,11,true,navy);
  const serviceTitleLines = wrapTextToWidth(bold, pdfText(input.serviceDescription, 'Freight transport service'), 310, 10, 2);
  serviceTitleLines.forEach((line, index) => fit(line, margin + 58, tableTop - 52 - index * 11, 310, 10, true));
  // Operational handover fields are sourced from the signed POD and verified job events.
  // Long delivery notes remain available in the attached POD and are marked as shortened.
  const notes = pdfText(input.deliveryNotes);
  const shortNotes = notes.length > 88 ? notes.slice(0, 82).trimEnd() + '... (full note in XDrive job record)' : notes;
  const details = [
    input.orderedAt ? 'Ordered: ' + formatDateTime(input.orderedAt) : '',
    input.vehicleDescription ? 'Vehicle: ' + pdfText(input.vehicleDescription) : '',
    input.cargoDescription ? 'Cargo: ' + pdfText(input.cargoDescription) : '',
    input.deliveredAt ? 'Delivered at: ' + formatDateTime(input.deliveredAt) : '',
    input.recipientName ? 'Received by: ' + pdfText(input.recipientName) : '',
    input.leftAt ? 'Left at: ' + pdfText(input.leftAt) : '',
    shortNotes ? 'Delivery notes: ' + shortNotes : '',
  ].filter(Boolean);
  const detailStartY = tableTop - 77 - (serviceTitleLines.length - 1) * 11;
  details.forEach((value,index)=>fit(value,margin+58,detailStartY-index*10,314,8.2,false,slate));
  const amount=money(finiteMoney(input.netAmount),input.currency);
  const aw=bold.widthOfTextAtSize(amount,11);
  page.drawText(amount,{x:555-14-aw,y:tableTop-54,font:bold,size:11,color:navy});
  // Bank transfer instruction and commercial totals.
  const boxY=147,boxH=111;
  page.drawRectangle({x:margin,y:boxY,width:248,height:boxH,color:pale,borderColor:border,borderWidth:.7});
  fit('PAYMENT DETAILS',margin+14,boxY+boxH-22,215,9.5,true,navy);
  page.drawRectangle({x:margin+14,y:boxY+boxH-30,width:220,height:1.5,color:orange});
  fit('Terms: '+pdfText(input.paymentTerms,'14 days'),margin+14,boxY+boxH-46,222,8.5,true);
  const bank=[
    input.bankAccountName?'Account: '+pdfText(input.bankAccountName):'',
    input.bankSortCode?'Sort code: '+pdfText(input.bankSortCode):'',
    input.bankAccountNumber?'Account no.: '+pdfText(input.bankAccountNumber):'',
    input.paypalEmail?'PayPal: '+pdfText(input.paypalEmail):'',
  ].filter(Boolean);
  if(bank.length) bank.slice(0,4).forEach((v,i)=>fit(v,margin+14,boxY+boxH-62-i*12,221,7.8,false,slate));
  else fit('Request payment instructions from the issuer',margin+14,boxY+boxH-65,221,7.4,false,slate);
  page.drawRectangle({x:otherX,y:boxY,width:248,height:boxH,color:white,borderColor:border,borderWidth:.8});
  const moneyRow=(t:string,v:string,y:number)=>{
    fit(t,otherX+13,y,142,8.7,false,slate);
    const width=regular.widthOfTextAtSize(v,9);
    page.drawText(v,{x:otherX+234-width,y,font:regular,size:9,color:navy});
  };
  moneyRow('Subtotal',money(finiteMoney(input.netAmount),input.currency),boxY+boxH-21);
  const vatLabel=vatTreatment==='not_registered'?'VAT (not registered)':vatTreatment==='reverse_charge'?'VAT (reverse charge)':'VAT ('+finiteMoney(input.vatRate)+'%)';
  moneyRow(vatLabel,vatTreatment==='not_registered'?money(0,input.currency):money(finiteMoney(input.vatAmount),input.currency),boxY+boxH-42);
  page.drawRectangle({x:otherX,y:boxY,width:248,height:44,color:navy});
  fit('TOTAL DUE',otherX+13,boxY+16,106,10,true,white);
  const total=money(finiteMoney(input.totalAmount),input.currency);
  const s=fitText(bold,total,126,17,11);
  page.drawText(total,{x:otherX+234-bold.widthOfTextAtSize(total,s),y:boxY+13,font:bold,size:s,color:white});
  const vatDisclosure=vatTreatment==='not_registered'?'Supplier not VAT registered - no VAT charged.':vatTreatment==='zero_rated'?'VAT zero-rated supply.':vatTreatment==='reverse_charge'?'Reverse charge: customer accounts for VAT.':'';
  if(vatDisclosure)fit(vatDisclosure,margin,137,contentWidth,8,false,slate);
  const evidenceCount=(input.evidenceImages?.length??0)+(input.signatureAttestation?1:0);
  if(evidenceCount)fit('Signed POD and supporting evidence attached: '+evidenceCount+' item(s)',margin,117,contentWidth,8,false,slate);
  // Page footer.
  page.drawLine({start:{x:margin,y:88},end:{x:555,y:88},color:border,thickness:.9});
  fit(issuerName,margin,70,245,9,true,navy);
  fit([input.issuerCompanyNumber?'Company '+pdfText(input.issuerCompanyNumber):'',pdfText(input.issuerEmail)].filter(Boolean).join('  |  '),margin,52,contentWidth,7.4,false,muted);
  fit('OFFICIAL XDRIVE INVOICE',410,70,145,7.4,true,muted);

  const evidenceItems = input.evidenceImages ?? [];
  const isPdfEvidence = (item: InvoiceEvidenceImage) => String.fromCharCode(...item.bytes.slice(0, 5)) === '%PDF-';
  const imageEvidence = evidenceItems.filter((item) => !isPdfEvidence(item));
  const pdfEvidence = evidenceItems.filter(isPdfEvidence);
  // Appendices
  if (input.signatureAttestation) {
    const attestation = pdf.addPage([595.28, 841.89]);
    attestation.drawText('Recipient attestation', { x: 42, y: 790, font: bold, size: 16, color: ink });
    wrapText(input.signatureAttestation, 92).forEach((text, index) => {
      attestation.drawText(text, { x: 42, y: 755 - index * 14, font: regular, size: 9, color: slate });
    });
  }

  for (const item of imageEvidence) {
    const image = await embedImage(pdf, item.bytes);
    if (!image) throw new Error('POD image is not a valid PNG or JPEG.');
    const appendix = pdf.addPage([595.28, 841.89]);
    appendix.drawText(pdfText(item.label, 'POD evidence'), { x: 42, y: 790, font: bold, size: 14, color: ink });
    const scale = Math.min(511 / image.width, 700 / image.height);
    appendix.drawImage(image, { x: 42, y: 55, width: image.width * scale, height: image.height * scale });
  }

  for (const item of pdfEvidence) {
    const document = await PDFDocument.load(item.bytes);
    const pages = await pdf.copyPages(document, document.getPageIndices());
    for (const evidencePage of pages) pdf.addPage(evidencePage);
  }

  return pdf.save();
}
