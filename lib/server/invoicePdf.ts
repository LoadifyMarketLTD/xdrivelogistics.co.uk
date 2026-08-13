import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont } from 'pdf-lib';

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

const fitText = (font: PDFFont, value: string, maxWidth: number, size: number, minSize = 6.8) => {
  let currentSize = size;
  while (currentSize > minSize && font.widthOfTextAtSize(value, currentSize) > maxWidth) {
    currentSize -= 0.25;
  }
  return currentSize;
};

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Official XDrive palette. The PDF keeps the approved invoice mock-up geometry,
  // while using the current platform brand colours and logo asset supplied by context.
  const navy = rgb(11 / 255, 47 / 255, 107 / 255);
  const dark = rgb(26 / 255, 31 / 255, 43 / 255);
  const grey = rgb(75 / 255, 85 / 255, 99 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);
  const line = rgb(218 / 255, 224 / 255, 232 / 255);
  const soft = rgb(248 / 255, 250 / 255, 252 / 255);
  const softHeader = rgb(244 / 255, 246 / 255, 248 / 255);
  const white = rgb(1, 1, 1);

  const pageWidth = 595.28;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const issuerName = pdfText(input.issuerName, 'Invoice issuer');

  const drawRight = (value: string, xRight: number, y: number, size: number, font: PDFFont, color = dark) => {
    const text = pdfText(value, '');
    const fitted = fitText(font, text, 150, size);
    const width = font.widthOfTextAtSize(text, fitted);
    page.drawText(text, { x: xRight - width, y, size: fitted, font, color });
  };

  // ---------------------------------------------------------------------------
  // Header: current XDrive logo and issuer details on the left.
  // ---------------------------------------------------------------------------
  let logoDrawn = false;
  if (input.logoBytes?.byteLength) {
    const logo = await embedImage(pdf, input.logoBytes);
    if (logo) {
      const maxWidth = 166;
      const maxHeight = 54;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
      page.drawImage(logo, {
        x: margin,
        y: 766,
        width: logo.width * scale,
        height: logo.height * scale,
      });
      logoDrawn = true;
    }
  }
  if (!logoDrawn) {
    page.drawText('XDrive', { x: margin, y: 792, size: 25, font: bold, color: navy });
    page.drawText('LOGISTICS', { x: margin + 61, y: 779, size: 8.8, font: bold, color: navy });
  }

  page.drawText(issuerName.slice(0, 70), { x: margin, y: 735, size: 13.5, font: bold, color: dark });
  let issuerY = 717;
  const issuerAddressLines = wrapText(pdfText(input.issuerAddress, ''), 48).filter(Boolean).slice(0, 3);
  for (const addressLine of issuerAddressLines) {
    page.drawText(addressLine, { x: margin, y: issuerY, size: 8.7, font: regular, color: grey });
    issuerY -= 12;
  }
  if (input.issuerVatNumber) {
    page.drawText(`UK VAT # ${pdfText(input.issuerVatNumber, '')}`.slice(0, 70), { x: margin, y: issuerY, size: 8.7, font: regular, color: dark });
    issuerY -= 17;
  }
  if (input.issuerEmail) {
    page.drawText('Email:', { x: margin, y: issuerY, size: 8.5, font: bold, color: dark });
    page.drawText(pdfText(input.issuerEmail, '').slice(0, 66), { x: margin + 31, y: issuerY, size: 8.5, font: regular, color: dark });
    issuerY -= 13;
  }
  if (input.issuerPhone) {
    page.drawText('Tel:', { x: margin, y: issuerY, size: 8.5, font: bold, color: dark });
    page.drawText(pdfText(input.issuerPhone, '').slice(0, 52), { x: margin + 20, y: issuerY, size: 8.5, font: regular, color: dark });
  }

  // ---------------------------------------------------------------------------
  // Right-side metadata and billing cards.
  // ---------------------------------------------------------------------------
  const metaX = 405;
  const metaY = 747;
  const metaW = 154;
  const metaH = 73;
  page.drawRectangle({ x: metaX, y: metaY, width: metaW, height: metaH, color: softHeader, borderColor: line, borderWidth: 0.55 });
  const metaRows: Array<[string, string]> = [
    ['DATE', formatDate(input.invoiceDate)],
    ['JOB REF', pdfText(input.jobReference, 'Not set')],
    ['INVOICE#', pdfText(input.invoiceNumber, 'Invoice')],
  ];
  metaRows.forEach(([label, value], index) => {
    const rowY = 798 - index * 22;
    if (index > 0) {
      page.drawLine({ start: { x: metaX + 12, y: rowY + 15 }, end: { x: metaX + metaW - 12, y: rowY + 15 }, thickness: 0.45, color: line });
    }
    page.drawText(label, { x: metaX + 12, y: rowY, size: 8.2, font: bold, color: grey });
    drawRight(value.slice(0, 32), metaX + metaW - 12, rowY, 9.1, index === 1 || index === 2 ? bold : regular);
  });

  const billX = 315;
  const billY = 649;
  const billW = 244;
  const billH = 87;
  page.drawRectangle({ x: billX, y: billY, width: billW, height: billH, color: softHeader, borderColor: line, borderWidth: 0.55 });
  page.drawText('Invoice to:', { x: billX + 14, y: billY + 65, size: 8.5, font: bold, color: dark });
  page.drawText(pdfText(input.clientName, 'Customer').slice(0, 52), { x: billX + 14, y: billY + 47, size: 11.2, font: bold, color: dark });
  let billTextY = billY + 32;
  for (const billLine of wrapText(pdfText(input.clientAddress, ''), 42).filter(Boolean).slice(0, 2)) {
    page.drawText(billLine, { x: billX + 14, y: billTextY, size: 8.2, font: regular, color: dark });
    billTextY -= 11;
  }
  if (input.clientEmail) {
    page.drawText(pdfText(input.clientEmail, '').slice(0, 55), { x: billX + 14, y: billTextY, size: 8.1, font: regular, color: dark });
  }

  // ---------------------------------------------------------------------------
  // INVOICE title tab: deliberately left-aligned and not full-width.
  // ---------------------------------------------------------------------------
  const titleY = 602;
  page.drawRectangle({ x: margin, y: titleY, width: 214, height: 35, color: navy });
  page.drawText('INVOICE', { x: margin + 14, y: titleY + 10, size: 19, font: bold, color: white });

  const tableX1 = margin + 110;
  const tableX2 = margin + 390;

  const drawRows = ({
    topY,
    rowHeight,
    firstLabel,
    firstValue,
    firstRight,
    secondLabel,
    secondValue,
    secondRight,
  }: {
    topY: number;
    rowHeight: number;
    firstLabel: string;
    firstValue: string;
    firstRight: string;
    secondLabel: string;
    secondValue: string;
    secondRight: string;
  }) => {
    const bottom = topY - rowHeight * 2;
    page.drawRectangle({ x: margin, y: bottom, width: contentWidth, height: rowHeight * 2, color: white, borderColor: line, borderWidth: 0.65 });
    page.drawLine({ start: { x: margin, y: topY - rowHeight }, end: { x: margin + contentWidth, y: topY - rowHeight }, thickness: 0.55, color: line });
    page.drawLine({ start: { x: tableX1, y: bottom }, end: { x: tableX1, y: topY }, thickness: 0.55, color: line });
    page.drawLine({ start: { x: tableX2, y: bottom }, end: { x: tableX2, y: topY }, thickness: 0.55, color: line });

    const row1Y = topY - rowHeight + 10;
    const row2Y = bottom + 10;
    page.drawText(firstLabel, { x: margin + 12, y: row1Y, size: 8.5, font: bold, color: dark });
    page.drawText(secondLabel, { x: margin + 12, y: row2Y, size: 8.5, font: bold, color: dark });

    const firstLines = wrapText(firstValue, 47).slice(0, 2);
    firstLines.forEach((lineValue, index) => {
      page.drawText(lineValue, { x: tableX1 + 11, y: row1Y + 1 - index * 10, size: 8.4, font: regular, color: dark });
    });
    page.drawText(pdfText(secondValue, 'Not provided').slice(0, 58), { x: tableX1 + 11, y: row2Y, size: 8.4, font: regular, color: dark });
    page.drawText(pdfText(firstRight, '').slice(0, 30), { x: tableX2 + 11, y: row1Y, size: 8.4, font: regular, color: dark });
    page.drawText(pdfText(secondRight, '').slice(0, 30), { x: tableX2 + 11, y: row2Y, size: 8.4, font: regular, color: dark });
  };

  // PICKUP is intentionally a light section header in the approved model.
  const pickupHeaderY = 573;
  page.drawRectangle({ x: margin, y: pickupHeaderY, width: contentWidth, height: 24, color: softHeader, borderColor: line, borderWidth: 0.55 });
  page.drawText('PICKUP', { x: margin + 13, y: pickupHeaderY + 8, size: 10.5, font: bold, color: navy });
  drawRows({
    topY: pickupHeaderY,
    rowHeight: 29,
    firstLabel: 'Location',
    firstValue: pdfText(input.pickupLocation, 'Collection location not provided'),
    firstRight: pdfText(input.cargoDescription, ''),
    secondLabel: 'Cargo Details',
    secondValue: formatDateTime(input.pickupDateTime),
    secondRight: pdfText(input.vehicleDescription || input.serviceDescription, 'Transport service'),
  });

  // DELIVERY remains the full-width navy anchor bar.
  const deliveryHeaderY = 487;
  page.drawRectangle({ x: margin, y: deliveryHeaderY, width: contentWidth, height: 26, color: navy });
  page.drawText('DELIVERY', { x: margin + 13, y: deliveryHeaderY + 9, size: 10.8, font: bold, color: white });
  drawRows({
    topY: deliveryHeaderY,
    rowHeight: 29,
    firstLabel: 'Location',
    firstValue: pdfText(input.deliveryLocation, 'Delivery location not provided'),
    firstRight: formatDateTime(input.deliveryDateTime),
    secondLabel: 'Recipient',
    secondValue: pdfText(input.recipientName, 'Not recorded'),
    secondRight: '',
  });

  // ---------------------------------------------------------------------------
  // POD / evidence strip. Only real evidence is drawn; no stock/fake imagery.
  // ---------------------------------------------------------------------------
  const evidence = (input.evidenceImages ?? []).slice(0, 4);
  const evidenceY = 318;
  const evidenceH = 102;
  if (evidence.length > 0) {
    const gap = 5;
    const boxW = (contentWidth - gap * (evidence.length - 1)) / evidence.length;
    for (let index = 0; index < evidence.length; index += 1) {
      const boxX = margin + index * (boxW + gap);
      page.drawRectangle({ x: boxX, y: evidenceY, width: boxW, height: evidenceH, color: soft, borderColor: line, borderWidth: 0.55 });
      const image = await embedImage(pdf, evidence[index].bytes);
      if (!image) continue;
      const pad = 2;
      const labelH = evidence[index].label ? 12 : 0;
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
        const labelText = pdfText(evidence[index].label, '').slice(0, 24);
        page.drawText(labelText, { x: boxX + 4, y: evidenceY + 3, size: 6.2, font: bold, color: navy });
      }
    }
  } else {
    page.drawRectangle({ x: margin, y: evidenceY + 36, width: contentWidth, height: 40, color: soft, borderColor: line, borderWidth: 0.55 });
    page.drawText('No POD / delivery images attached to this invoice yet.', { x: margin + 14, y: evidenceY + 52, size: 8.4, font: regular, color: muted });
  }

  // ---------------------------------------------------------------------------
  // Delivery confirmation + PAYABLE. Total is the only dominant financial value.
  // ---------------------------------------------------------------------------
  const payableY = 270;
  const payableH = 38;
  page.drawRectangle({ x: margin, y: payableY, width: contentWidth, height: payableH, color: softHeader, borderColor: line, borderWidth: 0.55 });
  page.drawText('Delivery by', { x: margin + 13, y: payableY + 22, size: 6.7, font: regular, color: muted });
  page.drawText(pdfText(input.recipientName, 'Recipient not recorded').slice(0, 46), { x: margin + 13, y: payableY + 9, size: 9, font: regular, color: dark });
  page.drawText('PAYABLE', { x: 395, y: payableY + 12, size: 10.8, font: bold, color: navy });
  const totalText = money(finiteMoney(input.totalAmount), input.currency);
  const totalSize = fitText(bold, totalText, 122, 21, 16);
  const totalWidth = bold.widthOfTextAtSize(totalText, totalSize);
  page.drawText(totalText, { x: margin + contentWidth - totalWidth - 12, y: payableY + 8, size: totalSize, font: bold, color: navy });

  // ---------------------------------------------------------------------------
  // Payment details table.
  // ---------------------------------------------------------------------------
  const payBoxY = 104;
  const payBoxH = 153;
  page.drawRectangle({ x: margin, y: payBoxY, width: contentWidth, height: payBoxH, color: white, borderColor: line, borderWidth: 0.65 });
  page.drawRectangle({ x: margin, y: payBoxY + payBoxH - 25, width: contentWidth, height: 25, color: softHeader });
  page.drawText('Payment Details', { x: margin + 12, y: payBoxY + payBoxH - 17, size: 10.5, font: bold, color: dark });

  const bankRowY = payBoxY + 101;
  page.drawText('Bank Transfer', { x: margin + 12, y: bankRowY + 11, size: 9.5, font: bold, color: dark });
  page.drawText('(Preferred Method)', { x: margin + 82, y: bankRowY + 11, size: 8.4, font: regular, color: dark });
  page.drawLine({ start: { x: margin, y: bankRowY }, end: { x: margin + contentWidth, y: bankRowY }, thickness: 0.55, color: line });

  const splitX = margin + 313;
  page.drawLine({ start: { x: splitX, y: payBoxY + 37 }, end: { x: splitX, y: bankRowY }, thickness: 0.55, color: line });
  page.drawLine({ start: { x: margin, y: payBoxY + 69 }, end: { x: margin + contentWidth, y: payBoxY + 69 }, thickness: 0.55, color: line });
  page.drawLine({ start: { x: margin, y: payBoxY + 37 }, end: { x: margin + contentWidth, y: payBoxY + 37 }, thickness: 0.55, color: line });

  page.drawText('Account Name:', { x: margin + 12, y: payBoxY + 80, size: 8.1, font: bold, color: dark });
  page.drawText(pdfText(input.bankAccountName, 'Not configured').slice(0, 35), { x: margin + 84, y: payBoxY + 80, size: 8.2, font: regular, color: dark });
  page.drawText('Sort code:', { x: splitX + 12, y: payBoxY + 80, size: 8.1, font: bold, color: dark });
  page.drawText(pdfText(input.bankSortCode, 'Not configured').slice(0, 18), { x: splitX + 59, y: payBoxY + 80, size: 8.2, font: regular, color: dark });

  page.drawText('Account Number:', { x: margin + 12, y: payBoxY + 49, size: 8.1, font: bold, color: dark });
  page.drawText(pdfText(input.bankAccountNumber, 'Not configured').slice(0, 24), { x: margin + 91, y: payBoxY + 49, size: 8.2, font: regular, color: dark });
  page.drawText('VAT:', { x: splitX + 12, y: payBoxY + 49, size: 8.1, font: bold, color: dark });
  page.drawText(`${finiteMoney(input.vatRate)}%`, { x: splitX + 37, y: payBoxY + 49, size: 8.2, font: regular, color: dark });

  page.drawText('PayPal:', { x: margin + 12, y: payBoxY + 17, size: 8.1, font: bold, color: dark });
  page.drawText(pdfText(input.paypalEmail, 'Not configured').slice(0, 64), { x: margin + 49, y: payBoxY + 17, size: 8.2, font: regular, color: dark });

  const terms = pdfText(input.paymentTerms, '14 days');
  page.drawText(`Payment terms: ${terms}. Late payments may incur administrative charges.`.slice(0, 112), { x: margin + 12, y: 84, size: 7.5, font: regular, color: dark });

  // ---------------------------------------------------------------------------
  // Footer: full-width navy, only verified company/contact data.
  // ---------------------------------------------------------------------------
  const footerH = 58;
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: footerH, color: navy });
  page.drawText(issuerName.slice(0, 58), { x: margin, y: 35, size: 9.1, font: bold, color: white });
  const footerAddress = pdfText(input.issuerAddress, '');
  if (footerAddress) {
    const startX = margin + Math.min(150, bold.widthOfTextAtSize(issuerName.slice(0, 58), 9.1) + 8);
    page.drawText(`| ${footerAddress}`.slice(0, 86), { x: startX, y: 35, size: 7.9, font: regular, color: white });
  }
  const contactParts = [input.issuerEmail, input.issuerPhone, input.issuerWebsite]
    .map((value) => pdfText(value, ''))
    .filter(Boolean)
    .join('  |  ');
  if (contactParts) {
    const contactSize = fitText(regular, contactParts, contentWidth, 8.1, 6.8);
    page.drawText(contactParts, { x: margin, y: 16, size: contactSize, font: regular, color: white });
  }

  return pdf.save();
}
