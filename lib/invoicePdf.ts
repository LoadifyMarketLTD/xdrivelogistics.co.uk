import type { InvoiceData } from '../app/components/InvoiceTemplate';
import type { CompanySettingsValues } from './companySettings';

const A4_PAGE: [number, number] = [595.28, 841.89];
const M = 36;
const NAVY = { r: 11 / 255, g: 47 / 255, b: 107 / 255 };
const ORANGE = { r: 245 / 255, g: 163 / 255, b: 0 };
const TEXT = { r: 26 / 255, g: 31 / 255, b: 43 / 255 };
const MUTED = { r: 102 / 255, g: 112 / 255, b: 133 / 255 };
const LINE = { r: 225 / 255, g: 228 / 255, b: 234 / 255 };
const SOFT = { r: 247 / 255, g: 249 / 255, b: 252 / 255 };

function safeDate(value?: string, withTime = false) {
  if (!value) return 'Not supplied';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return withTime
    ? d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric' });
}

function money(value: number) {
  return '£' + Number(value || 0).toFixed(2);
}

export async function downloadInvoicePdf({
  invoice,
  companySettings,
}: {
  invoice: InvoiceData;
  companySettings: CompanySettingsValues;
}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4_PAGE);
  const { width, height } = page.getSize();

  const color = (c: { r: number; g: number; b: number }) => rgb(c.r, c.g, c.b);
  const wrap = (value: string, maxWidth: number, font = regular, size = 9) => {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    if (!words.length) return ['—'];
    const lines: string[] = [];
    let current = words.shift() || '';
    for (const word of words) {
      const next = current + ' ' + word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
      else { lines.push(current); current = word; }
    }
    lines.push(current);
    return lines;
  };
  const drawLines = (lines: string[], x: number, y: number, opts?: { size?: number; font?: typeof regular; max?: number; lineHeight?: number; colour?: typeof TEXT }) => {
    const size = opts?.size ?? 9;
    const font = opts?.font ?? regular;
    const lh = opts?.lineHeight ?? 12;
    lines.slice(0, opts?.max ?? lines.length).forEach((line, index) => page.drawText(line, {
      x, y: y - index * lh, size, font, color: color(opts?.colour ?? TEXT),
    }));
  };
  const label = (text: string, x: number, y: number) => page.drawText(text.toUpperCase(), {
    x, y, size: 7.5, font: bold, color: color(MUTED),
  });
  const value = (text: string, x: number, y: number, size = 9.5) => page.drawText(text || '—', {
    x, y, size, font: bold, color: color(TEXT),
  });
  const box = (x: number, y: number, w: number, h: number, fill = SOFT) => page.drawRectangle({
    x, y, width: w, height: h, color: color(fill), borderColor: color(LINE), borderWidth: 0.8,
  });
  const sectionTitle = (title: string, x: number, y: number) => {
    page.drawText(title.toUpperCase(), { x, y, size: 8.5, font: bold, color: color(NAVY) });
    page.drawRectangle({ x, y: y - 4, width: 26, height: 2, color: color(ORANGE) });
  };

  const issuerName = invoice.issuerName || companySettings.legalName || companySettings.companyName;
  const issuerAddress = invoice.issuerAddress || [companySettings.street, companySettings.city, companySettings.postcode].filter(Boolean).join(', ');
  const issuerCompanyNo = invoice.issuerCompanyNumber || companySettings.companyNumber || '';
  const issuerVat = invoice.issuerVatNumber || '';
  const issuerXd = invoice.issuerXdId || '';
  const issuerEmail = invoice.issuerEmail || companySettings.email || '';
  const issuerPhone = invoice.issuerPhone || companySettings.phone || '';
  const bankName = invoice.bankAccountName || companySettings.bankAccountName || '';
  const bankSort = invoice.bankSortCode || companySettings.bankSortCode || '';
  const bankAccount = invoice.bankAccountNumber || companySettings.bankAccountNumber || '';

  // Header
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: color(NAVY) });
  page.drawRectangle({ x: 0, y: height - 94, width, height: 4, color: color(ORANGE) });
  page.drawText('XDRIVE', { x: M, y: height - 43, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText('LOGISTICS', { x: M + 88, y: height - 43, size: 12, font: bold, color: color(ORANGE) });
  page.drawText('Transport invoice', { x: M, y: height - 63, size: 9, font: regular, color: rgb(.9, .94, 1) });

  const titleX = width - 205;
  page.drawText('INVOICE', { x: titleX, y: height - 38, size: 18, font: bold, color: rgb(1,1,1) });
  page.drawText(invoice.invoiceNumber || '—', { x: titleX, y: height - 57, size: 10, font: bold, color: rgb(1,1,1) });
  page.drawText((invoice.status || 'Draft').toUpperCase(), { x: titleX, y: height - 73, size: 8, font: regular, color: rgb(.9,.94,1) });

  // Parties
  const top = height - 122;
  const colW = (width - M * 2 - 12) / 2;
  box(M, top - 112, colW, 112);
  box(M + colW + 12, top - 112, colW, 112);
  sectionTitle('Issued by', M + 12, top - 18);
  value(issuerName, M + 12, top - 38, 10);
  drawLines(wrap(issuerAddress, colW - 24, regular, 8.5), M + 12, top - 54, { size: 8.5, max: 3, lineHeight: 11 });
  const issuerMeta = [issuerXd ? 'XDrive ID ' + issuerXd : '', issuerCompanyNo ? 'Company No. ' + issuerCompanyNo : '', issuerVat ? 'VAT ' + issuerVat : ''].filter(Boolean).join(' · ');
  drawLines(wrap(issuerMeta || 'Business identity held in XDrive', colW - 24, regular, 7.5), M + 12, top - 91, { size: 7.5, max: 2, lineHeight: 9, colour: MUTED });

  const bx = M + colW + 24;
  sectionTitle('Bill to', bx, top - 18);
  value(invoice.clientName || 'Not supplied', bx, top - 38, 10);
  drawLines(wrap(invoice.clientAddress || 'Address not supplied', colW - 24, regular, 8.5), bx, top - 54, { size: 8.5, max: 3, lineHeight: 11 });
  const customerMeta = [
    invoice.customerXdId ? 'XDrive ID ' + invoice.customerXdId : '',
    invoice.customerCompanyNumber ? 'Company No. ' + invoice.customerCompanyNumber : '',
    invoice.customerVatNumber ? 'VAT ' + invoice.customerVatNumber : '',
  ].filter(Boolean).join(' · ');
  drawLines(wrap(customerMeta || invoice.clientEmail || 'Customer record', colW - 24, regular, 7.5), bx, top - 91, { size: 7.5, max: 2, lineHeight: 9, colour: MUTED });

  // Metadata strip
  const metaY = top - 142;
  box(M, metaY - 49, width - M * 2, 49, { r: 1, g: 1, b: 1 });
  const meta = [
    ['Invoice date', safeDate(invoice.date)],
    ['Due date', safeDate(invoice.dueDate)],
    ['Job ref', invoice.jobRef || '—'],
    ['Load ID', invoice.loadId || '—'],
    ['Customer ref', invoice.customerRef || '—'],
  ];
  const mw = (width - M * 2) / meta.length;
  meta.forEach(([k,v], i) => {
    const x = M + i * mw + 8;
    label(k, x, metaY - 16);
    drawLines(wrap(v, mw - 14, bold, 8), x, metaY - 31, { size: 8, font: bold, max: 2, lineHeight: 9 });
  });

  // Job details
  const jobY = metaY - 73;
  sectionTitle('Job & delivery record', M, jobY);
  const routeY = jobY - 23;
  box(M, routeY - 119, width - M * 2, 119);
  const routeLeft = M + 14;
  const routeRight = M + (width - M * 2) / 2 + 8;
  label('Collection', routeLeft, routeY - 18);
  drawLines(wrap(invoice.pickupLocation || 'Not supplied', 220, regular, 8.5), routeLeft, routeY - 34, { size: 8.5, max: 3, lineHeight: 11 });
  drawLines([safeDate(invoice.pickupDateTime, true)], routeLeft, routeY - 69, { size: 8, colour: MUTED });

  label('Delivery', routeRight, routeY - 18);
  drawLines(wrap(invoice.deliveryLocation || 'Not supplied', 220, regular, 8.5), routeRight, routeY - 34, { size: 8.5, max: 3, lineHeight: 11 });
  drawLines([safeDate(invoice.deliveryDateTime, true)], routeRight, routeY - 69, { size: 8, colour: MUTED });

  label('Vehicle', routeLeft, routeY - 91);
  value([invoice.vehicleType, invoice.vehicleRegistration].filter(Boolean).join(' · ') || 'Not supplied', routeLeft, routeY - 105, 8.5);
  label('Cargo', routeRight, routeY - 91);
  value(invoice.cargoSummary || (invoice.noOfItems ? invoice.noOfItems + ' item(s)' : 'Not supplied'), routeRight, routeY - 105, 8.5);

  // POD block
  const podY = routeY - 146;
  sectionTitle('Proof of delivery', M, podY);
  box(M, podY - 88, width - M * 2, 88, { r: .98, g: .99, b: 1 });
  const podCols = [
    ['Delivered', safeDate(invoice.deliveredAt || invoice.deliveryDateTime, true)],
    ['Received by', invoice.deliveryRecipient || invoice.recipientName || 'Not supplied'],
    ['Left at', invoice.leftAt || 'Not recorded'],
    ['Items', invoice.noOfItems != null ? String(invoice.noOfItems) : 'Not recorded'],
  ];
  const pw = (width - M * 2) / 4;
  podCols.forEach(([k,v], i) => {
    const x = M + i * pw + 10;
    label(k, x, podY - 20);
    drawLines(wrap(v, pw - 18, bold, 8), x, podY - 36, { size: 8, font: bold, max: 2, lineHeight: 9 });
  });
  label('Delivery notes', M + 10, podY - 60);
  drawLines(wrap(invoice.deliveryNotes || 'No delivery notes recorded.', width - M * 2 - 120, regular, 7.5), M + 96, podY - 60, { size: 7.5, max: 2, lineHeight: 9 });
  page.drawText(invoice.signature ? 'Recipient signature captured in XDrive' : 'POD status recorded in XDrive', {
    x: width - M - 190, y: podY - 80, size: 7, font: bold, color: color(NAVY),
  });

  // Charges
  const chY = podY - 112;
  sectionTitle('Charges', M, chY);
  const tableTop = chY - 18;
  page.drawRectangle({ x: M, y: tableTop - 24, width: width - M * 2, height: 24, color: color(NAVY) });
  const cols = [M + 10, M + 44, M + 330, M + 405, M + 472];
  ['Qty','Description','Net','VAT','Total'].forEach((h,i)=>page.drawText(h,{x:cols[i],y:tableTop-16,size:8,font:bold,color:rgb(1,1,1)}));
  box(M, tableTop - 72, width - M * 2, 48, { r:1,g:1,b:1 });
  value('1', cols[0], tableTop - 45, 8.5);
  drawLines(wrap(invoice.serviceDescription || 'Dedicated transport service', 270, regular, 8.5), cols[1], tableTop - 42, { size: 8.5, max: 2, lineHeight: 10 });
  value(money(invoice.netAmount), cols[2], tableTop - 45, 8.5);
  value(money(invoice.vatAmount) + ' (' + invoice.vatRate + '%)', cols[3], tableTop - 45, 8);
  value(money(invoice.amount), cols[4], tableTop - 45, 9);

  // Payment / totals
  const payY = tableTop - 93;
  const leftW = 325;
  box(M, payY - 109, leftW, 109, { r: .98, g: .99, b: 1 });
  box(M + leftW + 12, payY - 109, width - M * 2 - leftW - 12, 109, { r:1,g:1,b:1 });
  sectionTitle('Payment', M + 12, payY - 18);
  page.drawText('Please ensure payment is received by ' + safeDate(invoice.dueDate) + '.', {
    x: M + 12, y: payY - 38, size: 8.5, font: bold, color: color(TEXT),
  });
  page.drawText('Terms: ' + (invoice.paymentTerms || 'Not supplied'), { x: M + 12, y: payY - 54, size: 8, font: regular, color: color(TEXT) });
  if (bankName && bankSort && bankAccount) {
    page.drawText('Account: ' + bankName, { x: M + 12, y: payY - 70, size: 7.8, font: regular, color: color(TEXT) });
    page.drawText('Sort code: ' + bankSort + '   Account no: ' + bankAccount, { x: M + 12, y: payY - 84, size: 7.8, font: regular, color: color(TEXT) });
  } else {
    page.drawText('Bank details are available from the invoice issuer.', { x: M + 12, y: payY - 76, size: 7.8, font: regular, color: color(MUTED) });
  }
  drawLines(wrap(invoice.lateFee || 'Late-payment remedies apply only where legally and contractually applicable.', leftW - 24, regular, 6.8), M + 12, payY - 98, { size: 6.8, max: 2, lineHeight: 8, colour: MUTED });

  const tx = M + leftW + 24;
  const valX = width - M - 12;
  const totalRow = (name: string, val: string, y: number, emph = false) => {
    page.drawText(name, { x: tx, y, size: emph ? 9.5 : 8, font: emph ? bold : regular, color: color(TEXT) });
    const f = emph ? bold : regular;
    const size = emph ? 10.5 : 8.5;
    page.drawText(val, { x: valX - f.widthOfTextAtSize(val, size), y, size, font: f, color: color(emph ? NAVY : TEXT) });
  };
  totalRow('Subtotal', money(invoice.netAmount), payY - 28);
  totalRow('VAT', money(invoice.vatAmount), payY - 48);
  page.drawLine({ start:{x:tx,y:payY-61}, end:{x:valX,y:payY-61}, thickness:.7, color:color(LINE) });
  totalRow('TOTAL', money(invoice.amount), payY - 80, true);

  // Footer
  const footerY = 31;
  page.drawLine({ start:{x:M,y:footerY+21}, end:{x:width-M,y:footerY+21}, thickness:1, color:color(LINE) });
  const footer = [
    issuerName,
    issuerCompanyNo ? 'Company No. ' + issuerCompanyNo : '',
    issuerVat ? 'VAT ' + issuerVat : '',
    issuerXd ? 'XDrive ID ' + issuerXd : '',
    issuerEmail,
    issuerPhone,
  ].filter(Boolean).join(' · ');
  drawLines(wrap(footer, width - M * 2, regular, 6.8), M, footerY + 8, { size: 6.8, max: 2, lineHeight: 8, colour: MUTED });

  const bytes = await pdf.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = (invoice.invoiceNumber || 'invoice') + '.pdf';
  anchor.click();
  URL.revokeObjectURL(url);
}
