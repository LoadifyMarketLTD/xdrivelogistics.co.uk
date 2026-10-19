import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont } from 'pdf-lib';
import type { InvoiceVatTreatment } from '../invoiceVat';

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

  const ink = rgb(25 / 255, 31 / 255, 40 / 255);
  const slate = rgb(71 / 255, 85 / 255, 105 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);
  const border = rgb(221 / 255, 226 / 255, 232 / 255);
  const soft = rgb(247 / 255, 249 / 255, 251 / 255);


  const pageWidth = 595.28;
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const issuerName = pdfText(input.issuerName, 'Invoice issuer');
  const vatTreatment = fallbackVatTreatment(input);

  const drawLabelValue = (
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    options: { valueBold?: boolean; size?: number } = {},
  ) => {
    if (!value) return;
    page.drawText(label.toUpperCase(), { x, y, size: 6.5, font: bold, color: muted });
    const valueSize = fitText(options.valueBold ? bold : regular, value, width, options.size ?? 9.2, 6.4);
    page.drawText(value, {
      x,
      y: y - 13,
      size: valueSize,
      font: options.valueBold ? bold : regular,
      color: ink,
    });
  };

  // Header
  let logoDrawn = false;
  if (input.logoBytes?.byteLength) {
    const logo = await embedImage(pdf, input.logoBytes);
    if (logo) {
      const maxWidth = 150;
      const maxHeight = 50;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
      page.drawImage(logo, {
        x: margin,
        y: 760,
        width: logo.width * scale,
        height: logo.height * scale,
      });
      logoDrawn = true;
    }
  }

  if (!logoDrawn) {
    const size = fitText(bold, issuerName, 245, 22, 13);
    page.drawText(issuerName, { x: margin, y: 790, size, font: bold, color: ink });
  }

  const invoiceTitle = 'INVOICE';
  const invoiceTitleWidth = bold.widthOfTextAtSize(invoiceTitle, 24);
  page.drawText(invoiceTitle, {
    x: pageWidth - margin - invoiceTitleWidth,
    y: 790,
    size: 24,
    font: bold,
    color: ink,
  });

  let issuerY = logoDrawn ? 744 : 760;
  const issuerAddress = wrapText(pdfText(input.issuerAddress), 52).slice(0, 3);
  issuerAddress.forEach((line, index) => {
    page.drawText(line, { x: margin, y: issuerY - index * 11, size: 8.5, font: regular, color: slate });
  });
  issuerY -= issuerAddress.length * 11;

  const issuerMeta = [
    input.issuerCompanyNumber ? `Company No. ${pdfText(input.issuerCompanyNumber)}` : '',
    input.issuerVatNumber && vatTreatment !== 'not_registered' ? `VAT No. ${pdfText(input.issuerVatNumber)}` : '',
  ].filter(Boolean).join('  |  ');
  if (issuerMeta) {
    page.drawText(issuerMeta, { x: margin, y: issuerY - 2, size: 8.1, font: regular, color: slate });
    issuerY -= 13;
  }
  const issuerContact = [input.issuerEmail, input.issuerPhone, input.issuerWebsite]
    .map((v) => pdfText(v))
    .filter(Boolean)
    .join('  |  ');
  if (issuerContact) {
    const contactSize = fitText(regular, issuerContact, 280, 8.1, 6.6);
    page.drawText(issuerContact, { x: margin, y: issuerY - 1, size: contactSize, font: regular, color: slate });
  }

  // Invoice metadata - no boxes, no overlap
  const metaX = 374;
  const metaWidth = pageWidth - margin - metaX;
  const ref = pdfText(input.jobReference || input.loadId);
  drawLabelValue('Invoice no.', pdfText(input.invoiceNumber, 'Invoice'), metaX, 757, metaWidth, { valueBold: true });
  drawLabelValue('Invoice date', formatDate(input.invoiceDate), metaX, 719, metaWidth);
  drawLabelValue('Due date', formatDate(input.dueDate), metaX, 681, metaWidth);
  if (ref) drawLabelValue('Job / load ref', ref, metaX, 643, metaWidth, { valueBold: true });

  page.drawLine({
    start: { x: margin, y: 620 },
    end: { x: pageWidth - margin, y: 620 },
    thickness: 1,
    color: border,
  });

  // Parties
  page.drawText('FROM', { x: margin, y: 593, size: 7, font: bold, color: muted });
  page.drawText('BILL TO', { x: 315, y: 593, size: 7, font: bold, color: muted });

  page.drawText(issuerName, { x: margin, y: 574, size: 11.5, font: bold, color: ink });
  const fromY = 559;
  wrapText(pdfText(input.issuerAddress), 45).slice(0, 4).forEach((line, index) => {
    page.drawText(line, { x: margin, y: fromY - index * 11, size: 8.5, font: regular, color: slate });
  });

  const clientName = pdfText(input.clientName, 'Customer');
  page.drawText(clientName, { x: 315, y: 574, size: 11.5, font: bold, color: ink });
  let clientY = 559;
  const clientAddress = wrapText(pdfText(input.clientAddress), 41).slice(0, 4);
  clientAddress.forEach((line, index) => {
    page.drawText(line, { x: 315, y: clientY - index * 11, size: 8.5, font: regular, color: slate });
  });
  clientY -= clientAddress.length * 11;
  if (input.clientEmail) {
    page.drawText(pdfText(input.clientEmail), { x: 315, y: clientY, size: 8.3, font: regular, color: slate });
    clientY -= 11;
  }
  const customerMeta = [
    input.customerCompanyNumber ? `Company No. ${pdfText(input.customerCompanyNumber)}` : '',
    input.customerVatNumber ? `VAT No. ${pdfText(input.customerVatNumber)}` : '',
    input.customerReference ? `Customer Ref. ${pdfText(input.customerReference)}` : '',
  ].filter(Boolean);
  customerMeta.slice(0, 2).forEach((line, index) => {
    page.drawText(line, { x: 315, y: clientY - index * 10, size: 7.7, font: regular, color: muted });
  });

  // Commercial line item table
  const tableTop = 465;
  const tableX = margin;
  const qtyW = 38;
  const descW = 295;
  const unitW = 88;
  const totalW = contentWidth - qtyW - descW - unitW;
  const headerH = 24;
  const rowH = 122;

  page.drawRectangle({ x: tableX, y: tableTop - headerH, width: contentWidth, height: headerH, color: soft });
  page.drawRectangle({
    x: tableX,
    y: tableTop - headerH - rowH,
    width: contentWidth,
    height: headerH + rowH,
    borderColor: border,
    borderWidth: 0.8,
  });

  const xQty = tableX;
  const xDesc = xQty + qtyW;
  const xUnit = xDesc + descW;
  const xTotal = xUnit + unitW;
  [xDesc, xUnit, xTotal].forEach((x) => {
    page.drawLine({
      start: { x, y: tableTop - headerH - rowH },
      end: { x, y: tableTop },
      thickness: 0.6,
      color: border,
    });
  });

  page.drawText('QTY', { x: xQty + 11, y: tableTop - 16, size: 7.2, font: bold, color: muted });
  page.drawText('DESCRIPTION', { x: xDesc + 11, y: tableTop - 16, size: 7.2, font: bold, color: muted });
  page.drawText('UNIT PRICE', { x: xUnit + 11, y: tableTop - 16, size: 7.2, font: bold, color: muted });
  page.drawText('TOTAL', { x: xTotal + 11, y: tableTop - 16, size: 7.2, font: bold, color: muted });

  page.drawText('1', { x: xQty + 14, y: tableTop - 48, size: 10, font: regular, color: ink });

  const serviceTitle = pdfText(input.serviceDescription || 'Transport service');
  page.drawText(serviceTitle, { x: xDesc + 11, y: tableTop - 46, size: 10, font: bold, color: ink });

  const descriptionLines: string[] = [];
  if (input.pickupLocation && input.deliveryLocation) {
    descriptionLines.push(`${pdfText(input.pickupLocation)} -> ${pdfText(input.deliveryLocation)}`);
  } else if (input.pickupLocation) {
    descriptionLines.push(`Collection: ${pdfText(input.pickupLocation)}`);
  } else if (input.deliveryLocation) {
    descriptionLines.push(`Delivery: ${pdfText(input.deliveryLocation)}`);
  }
  if (input.vehicleDescription) descriptionLines.push(`Vehicle: ${pdfText(input.vehicleDescription)}`);
  if (input.cargoDescription) descriptionLines.push(`Goods: ${pdfText(input.cargoDescription)}`);
  const serviceDate = input.deliveryDateTime || input.pickupDateTime || input.orderedAt;
  if (serviceDate) descriptionLines.push(`Service date: ${formatDateTime(serviceDate)}`);
  if (input.recipientName) descriptionLines.push(`Received by: ${pdfText(input.recipientName)}`);
  if (input.deliveryNotes) descriptionLines.push(`Delivery notes: ${pdfText(input.deliveryNotes)}`);

  let descY = tableTop - 63;
  for (const detail of descriptionLines.slice(0, 6)) {
    const wrapped = wrapText(detail, 58).slice(0, 2);
    wrapped.forEach((line, index) => {
      page.drawText(line, { x: xDesc + 11, y: descY - index * 10, size: 8.1, font: regular, color: slate });
    });
    descY -= wrapped.length * 10 + 2;
    if (descY < tableTop - headerH - rowH + 12) break;
  }

  const unitPrice = money(finiteMoney(input.netAmount), input.currency);
  const totalValue = money(finiteMoney(input.totalAmount), input.currency);
  const unitSize = fitText(regular, unitPrice, unitW - 20, 9.2, 7);
  const totalSize = fitText(bold, totalValue, totalW - 20, 9.5, 7);
  page.drawText(unitPrice, { x: xUnit + 11, y: tableTop - 48, size: unitSize, font: regular, color: ink });
  page.drawText(totalValue, { x: xTotal + 11, y: tableTop - 48, size: totalSize, font: bold, color: ink });

  // Totals
  const totalsX = 350;
  const totalsY = 252;
  const totalsW = pageWidth - margin - totalsX;
  const amountRow = (label: string, value: string, y: number, strong = false) => {
    page.drawText(label, { x: totalsX, y, size: strong ? 9.5 : 8.5, font: strong ? bold : regular, color: strong ? ink : slate });
    const font = strong ? bold : regular;
    const size = strong ? 11 : 8.8;
    const fitted = fitText(font, value, 82, size, 7);
    const width = font.widthOfTextAtSize(value, fitted);
    page.drawText(value, { x: totalsX + totalsW - width, y, size: fitted, font, color: strong ? ink : slate });
  };

  amountRow('Subtotal', money(finiteMoney(input.netAmount), input.currency), totalsY + 54);
  const vatLabel = vatTreatment === 'not_registered'
    ? 'VAT'
    : vatTreatment === 'zero_rated'
      ? 'VAT (0%)'
      : vatTreatment === 'reverse_charge'
        ? 'VAT (reverse charge)'
        : `VAT (${finiteMoney(input.vatRate)}%)`;
  amountRow(vatLabel, vatTreatment === 'not_registered' ? 'Not registered' : money(finiteMoney(input.vatAmount), input.currency), totalsY + 31);
  page.drawLine({ start: { x: totalsX, y: totalsY + 20 }, end: { x: totalsX + totalsW, y: totalsY + 20 }, thickness: 0.8, color: border });
  amountRow('TOTAL DUE', totalValue, totalsY - 1, true);

  // Payment terms and details
  page.drawText('PAYMENT DETAILS', { x: margin, y: 285, size: 7, font: bold, color: muted });
  const paymentTerms = pdfText(input.paymentTerms, '14 days');
  page.drawText(`Payment terms: ${paymentTerms}`, { x: margin, y: 265, size: 9, font: bold, color: ink });
  page.drawText(`Due date: ${formatDate(input.dueDate)}`, { x: margin, y: 249, size: 8.5, font: regular, color: slate });

  const bankLines = [
    input.bankAccountName ? `Account name: ${pdfText(input.bankAccountName)}` : '',
    input.bankSortCode ? `Sort code: ${pdfText(input.bankSortCode)}` : '',
    input.bankAccountNumber ? `Account number: ${pdfText(input.bankAccountNumber)}` : '',
    input.paypalEmail ? `PayPal: ${pdfText(input.paypalEmail)}` : '',
  ].filter(Boolean);
  bankLines.forEach((line, index) => {
    page.drawText(line, { x: margin, y: 226 - index * 15, size: 8.5, font: regular, color: slate });
  });

  const vatDisclosure = vatTreatment === 'not_registered'
    ? 'Issuer is not VAT registered; no VAT has been charged.'
    : vatTreatment === 'zero_rated'
      ? 'Zero-rated supply: VAT charged at 0%.'
      : vatTreatment === 'reverse_charge'
        ? 'Reverse charge applies: customer accounts for VAT.'
        : '';
  if (vatDisclosure) {
    page.drawText(vatDisclosure, { x: margin, y: 156, size: 7.5, font: regular, color: muted });
  }

  const evidenceItems = input.evidenceImages ?? [];
  const isPdfEvidence = (item: InvoiceEvidenceImage) => String.fromCharCode(...item.bytes.slice(0, 5)) === '%PDF-';
  const imageEvidence = evidenceItems.filter((item) => !isPdfEvidence(item));
  const pdfEvidence = evidenceItems.filter(isPdfEvidence);
  const evidenceCount = evidenceItems.length + (input.signatureAttestation ? 1 : 0);
  if (evidenceCount > 0) {
    page.drawText(
      `Supporting POD evidence is attached in ${evidenceCount} appendix item${evidenceCount === 1 ? '' : 's'}.`,
      { x: margin, y: 137, size: 7.5, font: regular, color: muted },
    );
  }

  // Footer - issuer only
  page.drawLine({
    start: { x: margin, y: 92 },
    end: { x: pageWidth - margin, y: 92 },
    thickness: 0.8,
    color: border,
  });
  page.drawText(issuerName, { x: margin, y: 72, size: 8.8, font: bold, color: ink });
  const footerMeta = [
    input.issuerCompanyNumber ? `Company No. ${pdfText(input.issuerCompanyNumber)}` : '',
    input.issuerVatNumber && vatTreatment !== 'not_registered' ? `VAT No. ${pdfText(input.issuerVatNumber)}` : '',
  ].filter(Boolean).join('  |  ');
  if (footerMeta) {
    page.drawText(footerMeta, { x: margin, y: 57, size: 7.5, font: regular, color: slate });
  }
  const footerContact = [input.issuerEmail, input.issuerPhone, input.issuerWebsite]
    .map((v) => pdfText(v))
    .filter(Boolean)
    .join('  |  ');
  if (footerContact) {
    const footerSize = fitText(regular, footerContact, contentWidth, 7.5, 6.3);
    page.drawText(footerContact, { x: margin, y: 42, size: footerSize, font: regular, color: slate });
  }

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
