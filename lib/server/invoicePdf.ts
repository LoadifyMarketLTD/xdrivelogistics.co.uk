import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib';

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
  issuerEmail?: string | null;
  issuerPhone?: string | null;
  issuerWebsite?: string | null;
  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
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
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  totalAmount: number;
  currency: string;
  paymentTerms?: string | null;
};

const safeText = (value: string | null | undefined, fallback = 'Not provided') =>
  value?.trim() || fallback;

const pdfText = (value: string | null | undefined, fallback = 'Not provided') =>
  safeText(value, fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\u00A3\u20AC]/g, '?');

const finiteMoney = (value: number) => Number.isFinite(value) ? value : 0;

const money = (value: number, currency: string) => {
  try {
    return pdfText(new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value));
  } catch {
    return `${value.toFixed(2)} ${pdfText(currency, 'GBP')}`;
  }
};

const wrapText = (text: string, maxChars = 60) => {
  const words = pdfText(text, '').split(/\s+/).filter(Boolean);
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
  return lines.length ? lines : [''];
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Not set';
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) return pdfText(value, 'Not set');
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return pdfText(value, 'Not set');
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  });
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

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(10 / 255, 35 / 255, 79 / 255);
  const blue = rgb(14 / 255, 63 / 255, 169 / 255);
  const orange = rgb(245 / 255, 163 / 255, 0);
  const dark = rgb(26 / 255, 31 / 255, 43 / 255);
  const grey = rgb(75 / 255, 85 / 255, 99 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);
  const line = rgb(216 / 255, 222 / 255, 232 / 255);
  const soft = rgb(247 / 255, 249 / 255, 252 / 255);
  const softBlue = rgb(241 / 255, 245 / 255, 249 / 255);
  const white = rgb(1, 1, 1);

  const margin = 28;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - margin * 2;
  const issuerName = pdfText(input.issuerName, 'Invoice issuer');

  // Brand / issuer block.
  let logoDrawn = false;
  if (input.logoBytes?.byteLength) {
    const logo = await embedImage(pdf, input.logoBytes);
    if (logo) {
      const maxWidth = 155;
      const maxHeight = 52;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
      page.drawImage(logo, {
        x: margin,
        y: 772,
        width: logo.width * scale,
        height: logo.height * scale,
      });
      logoDrawn = true;
    }
  }
  if (!logoDrawn) {
    page.drawText('XDrive', { x: margin, y: 790, size: 25, font: bold, color: navy });
    page.drawText('LOGISTICS', { x: margin + 58, y: 777, size: 9, font: bold, color: navy });
  }

  page.drawText(issuerName.slice(0, 70), { x: margin, y: 744, size: 13, font: bold, color: dark });
  let issuerY = 728;
  for (const addressLine of wrapText(pdfText(input.issuerAddress, ''), 48).slice(0, 3)) {
    if (addressLine) {
      page.drawText(addressLine, { x: margin, y: issuerY, size: 8.6, font: regular, color: grey });
      issuerY -= 12;
    }
  }
  if (input.issuerVatNumber) {
    page.drawText(`UK VAT # ${pdfText(input.issuerVatNumber, '')}`.slice(0, 70), { x: margin, y: issuerY, size: 8.6, font: regular, color: dark });
    issuerY -= 12;
  }
  if (input.issuerEmail) {
    page.drawText(`Email: ${pdfText(input.issuerEmail, '')}`.slice(0, 75), { x: margin, y: issuerY, size: 8.4, font: regular, color: dark });
    issuerY -= 12;
  }
  if (input.issuerPhone) {
    page.drawText(`Tel: ${pdfText(input.issuerPhone, '')}`.slice(0, 70), { x: margin, y: issuerY, size: 8.4, font: regular, color: dark });
  }

  // Invoice metadata card.
  const metaX = 335;
  const metaY = 748;
  const metaW = 232;
  const metaH = 72;
  page.drawRectangle({ x: metaX, y: metaY, width: metaW, height: metaH, color: softBlue, borderColor: line, borderWidth: 0.8 });
  const metaRows: Array<[string, string]> = [
    ['DATE', formatDate(input.invoiceDate)],
    ['JOB REF', pdfText(input.jobReference, 'Not set')],
    ['INVOICE#', pdfText(input.invoiceNumber, 'Invoice')],
  ];
  metaRows.forEach(([label, value], index) => {
    const y = 798 - index * 22;
    if (index > 0) page.drawLine({ start: { x: metaX + 14, y: y + 15 }, end: { x: metaX + metaW - 14, y: y + 15 }, thickness: 0.6, color: line });
    page.drawText(label, { x: metaX + 14, y, size: 8.5, font: bold, color: navy });
    const valueWidth = regular.widthOfTextAtSize(value, 9.2);
    page.drawText(value.slice(0, 40), { x: Math.max(metaX + 94, metaX + metaW - 14 - valueWidth), y, size: 9.2, font: regular, color: dark });
  });

  // Bill-to card.
  const billY = 650;
  page.drawRectangle({ x: metaX, y: billY, width: metaW, height: 88, color: softBlue, borderColor: line, borderWidth: 0.8 });
  page.drawText('Invoice to:', { x: metaX + 14, y: billY + 67, size: 8.5, font: bold, color: dark });
  page.drawText(pdfText(input.clientName, 'Customer').slice(0, 55), { x: metaX + 14, y: billY + 47, size: 11.5, font: bold, color: dark });
  let billTextY = billY + 31;
  for (const billLine of wrapText(pdfText(input.clientAddress, ''), 38).slice(0, 2)) {
    if (billLine) {
      page.drawText(billLine, { x: metaX + 14, y: billTextY, size: 8.2, font: regular, color: dark });
      billTextY -= 12;
    }
  }
  if (input.clientEmail) page.drawText(pdfText(input.clientEmail, '').slice(0, 55), { x: metaX + 14, y: billTextY, size: 8.2, font: regular, color: dark });

  // INVOICE title tab.
  page.drawRectangle({ x: margin, y: 616, width: 240, height: 38, color: navy });
  page.drawText('INVOICE', { x: margin + 16, y: 628, size: 20, font: bold, color: white });

  const drawSectionBar = (title: string, y: number) => {
    page.drawRectangle({ x: margin, y, width: contentWidth, height: 27, color: navy });
    page.drawText(title, { x: margin + 14, y: y + 9, size: 11, font: bold, color: white });
  };

  const drawOperationGrid = ({
    topY,
    location,
    sideText,
    secondLabel,
    secondValue,
    dateTime,
  }: {
    topY: number;
    location: string;
    sideText: string;
    secondLabel: string;
    secondValue: string;
    dateTime: string;
  }) => {
    const h = 62;
    const bottom = topY - h;
    const x1 = margin + 136;
    const x2 = margin + 405;
    page.drawRectangle({ x: margin, y: bottom, width: contentWidth, height: h, color: white, borderColor: line, borderWidth: 0.8 });
    page.drawLine({ start: { x: margin, y: bottom + 31 }, end: { x: margin + contentWidth, y: bottom + 31 }, thickness: 0.7, color: line });
    page.drawLine({ start: { x: x1, y: bottom }, end: { x: x1, y: topY }, thickness: 0.7, color: line });
    page.drawLine({ start: { x: x2, y: bottom }, end: { x: x2, y: topY }, thickness: 0.7, color: line });

    page.drawText('Location', { x: margin + 14, y: bottom + 43, size: 8.5, font: bold, color: dark });
    page.drawText(secondLabel, { x: margin + 14, y: bottom + 12, size: 8.5, font: bold, color: dark });

    const locationLines = wrapText(location, 43).slice(0, 2);
    locationLines.forEach((value, index) => page.drawText(value, { x: x1 + 12, y: bottom + 45 - index * 11, size: 8.5, font: regular, color: dark }));
    page.drawText(pdfText(secondValue, 'Not provided').slice(0, 56), { x: x1 + 12, y: bottom + 11, size: 8.4, font: regular, color: dark });
    page.drawText(pdfText(sideText, '').slice(0, 30), { x: x2 + 13, y: bottom + 43, size: 8.5, font: regular, color: dark });
    page.drawText(pdfText(dateTime, 'Not set').slice(0, 32), { x: x2 + 13, y: bottom + 11, size: 8.4, font: regular, color: dark });
  };

  drawSectionBar('PICKUP', 576);
  drawOperationGrid({
    topY: 576,
    location: pdfText(input.pickupLocation, 'Collection location not provided'),
    sideText: pdfText(input.cargoDescription, ''),
    secondLabel: 'Cargo Details',
    secondValue: pdfText(input.vehicleDescription || input.serviceDescription, 'Transport service'),
    dateTime: formatDateTime(input.pickupDateTime),
  });

  drawSectionBar('DELIVERY', 480);
  drawOperationGrid({
    topY: 480,
    location: pdfText(input.deliveryLocation, 'Delivery location not provided'),
    sideText: formatDateTime(input.deliveryDateTime),
    secondLabel: 'Recipient',
    secondValue: pdfText(input.recipientName, 'Not recorded'),
    dateTime: input.recipientName ? 'POD captured' : 'POD not recorded',
  });

  // POD / operational photo strip.
  const evidenceY = 315;
  const evidenceH = 92;
  const evidence = (input.evidenceImages ?? []).slice(0, 4);
  if (evidence.length > 0) {
    const gap = 6;
    const boxW = (contentWidth - gap * (evidence.length - 1)) / evidence.length;
    for (let index = 0; index < evidence.length; index += 1) {
      const boxX = margin + index * (boxW + gap);
      page.drawRectangle({ x: boxX, y: evidenceY, width: boxW, height: evidenceH, color: soft, borderColor: line, borderWidth: 0.7 });
      const image = await embedImage(pdf, evidence[index].bytes);
      if (image) {
        const pad = 2;
        const labelH = evidence[index].label ? 13 : 0;
        const maxW = boxW - pad * 2;
        const maxH = evidenceH - pad * 2 - labelH;
        const scale = Math.min(maxW / image.width, maxH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        page.drawImage(image, {
          x: boxX + (boxW - drawW) / 2,
          y: evidenceY + labelH + (maxH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
        if (evidence[index].label) {
          page.drawText(pdfText(evidence[index].label, '').slice(0, 22), { x: boxX + 4, y: evidenceY + 3, size: 6.5, font: bold, color: navy });
        }
      }
    }
  } else {
    page.drawRectangle({ x: margin, y: evidenceY, width: contentWidth, height: evidenceH, color: soft, borderColor: line, borderWidth: 0.7 });
    page.drawText('POD / delivery evidence will appear here when available.', { x: margin + 16, y: evidenceY + 40, size: 9, font: regular, color: muted });
  }

  // Delivered-by + payable strip.
  const payableY = 274;
  page.drawRectangle({ x: margin, y: payableY, width: contentWidth, height: 31, color: softBlue, borderColor: line, borderWidth: 0.7 });
  page.drawText('Delivery by', { x: margin + 14, y: payableY + 18, size: 7.5, font: regular, color: muted });
  page.drawText(pdfText(input.recipientName, 'Recipient not recorded').slice(0, 44), { x: margin + 14, y: payableY + 6, size: 9.3, font: regular, color: dark });
  page.drawText(`Net ${money(finiteMoney(input.netAmount), input.currency)}  +  VAT ${money(finiteMoney(input.vatAmount), input.currency)}`, { x: 285, y: payableY + 18, size: 7.4, font: regular, color: muted });
  page.drawText('PAYABLE', { x: 412, y: payableY + 7, size: 11, font: bold, color: dark });
  const totalText = money(finiteMoney(input.totalAmount), input.currency);
  const totalWidth = bold.widthOfTextAtSize(totalText, 20);
  page.drawText(totalText, { x: margin + contentWidth - totalWidth - 14, y: payableY + 5, size: 20, font: bold, color: navy });

  // Payment details.
  const payBoxY = 104;
  const payBoxH = 158;
  page.drawRectangle({ x: margin, y: payBoxY, width: contentWidth, height: payBoxH, color: white, borderColor: line, borderWidth: 0.8 });
  page.drawRectangle({ x: margin, y: payBoxY + payBoxH - 27, width: contentWidth, height: 27, color: softBlue });
  page.drawText('Payment Details', { x: margin + 14, y: payBoxY + payBoxH - 18, size: 11, font: bold, color: dark });
  page.drawText('Bank Transfer', { x: margin + 14, y: payBoxY + 112, size: 9.5, font: bold, color: dark });
  page.drawText('(Preferred Method)', { x: margin + 79, y: payBoxY + 112, size: 8.5, font: regular, color: dark });
  page.drawLine({ start: { x: margin, y: payBoxY + 98 }, end: { x: margin + contentWidth, y: payBoxY + 98 }, thickness: 0.7, color: line });
  page.drawLine({ start: { x: margin + 315, y: payBoxY + 38 }, end: { x: margin + 315, y: payBoxY + 98 }, thickness: 0.7, color: line });
  page.drawLine({ start: { x: margin, y: payBoxY + 68 }, end: { x: margin + contentWidth, y: payBoxY + 68 }, thickness: 0.7, color: line });
  page.drawLine({ start: { x: margin, y: payBoxY + 38 }, end: { x: margin + contentWidth, y: payBoxY + 38 }, thickness: 0.7, color: line });

  page.drawText('Account Name:', { x: margin + 14, y: payBoxY + 80, size: 8, font: bold, color: dark });
  page.drawText(pdfText(input.bankAccountName, 'Not configured').slice(0, 36), { x: margin + 88, y: payBoxY + 80, size: 8.2, font: regular, color: dark });
  page.drawText('Sort code:', { x: margin + 330, y: payBoxY + 80, size: 8, font: bold, color: dark });
  page.drawText(pdfText(input.bankSortCode, 'Not configured').slice(0, 18), { x: margin + 380, y: payBoxY + 80, size: 8.2, font: regular, color: dark });

  page.drawText('Account Number:', { x: margin + 14, y: payBoxY + 50, size: 8, font: bold, color: dark });
  page.drawText(pdfText(input.bankAccountNumber, 'Not configured').slice(0, 24), { x: margin + 94, y: payBoxY + 50, size: 8.2, font: regular, color: dark });
  page.drawText('VAT:', { x: margin + 330, y: payBoxY + 50, size: 8, font: bold, color: dark });
  page.drawText(`${finiteMoney(input.vatRate)}%`, { x: margin + 355, y: payBoxY + 50, size: 8.2, font: regular, color: dark });

  page.drawText('PayPal:', { x: margin + 14, y: payBoxY + 20, size: 8, font: bold, color: dark });
  page.drawText(pdfText(input.paypalEmail, 'Not configured').slice(0, 55), { x: margin + 52, y: payBoxY + 20, size: 8.2, font: regular, color: dark });

  const terms = pdfText(input.paymentTerms, '14 days');
  page.drawText(`Payment terms: ${terms}. Late payments may incur administrative charges.`.slice(0, 105), { x: margin + 14, y: 89, size: 7.6, font: regular, color: dark });

  // Footer.
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 70, color: navy });
  page.drawText(issuerName.slice(0, 65), { x: margin, y: 43, size: 9.5, font: bold, color: white });
  const footerAddress = pdfText(input.issuerAddress, '');
  if (footerAddress) page.drawText(` | ${footerAddress}`.slice(0, 92), { x: margin + Math.min(160, bold.widthOfTextAtSize(issuerName.slice(0, 65), 9.5) + 8), y: 43, size: 8.3, font: regular, color: white });
  const contactParts = [input.issuerEmail, input.issuerPhone, input.issuerWebsite]
    .map((value) => pdfText(value, ''))
    .filter(Boolean)
    .join(' | ');
  if (contactParts) page.drawText(contactParts.slice(0, 105), { x: margin, y: 22, size: 8.2, font: regular, color: white });

  // Small XDrive accent line above footer.
  page.drawRectangle({ x: 0, y: 70, width: pageWidth, height: 2, color: orange });
  page.drawRectangle({ x: 0, y: 72, width: 120, height: 2, color: blue });

  return pdf.save();
}
