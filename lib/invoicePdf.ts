import type { InvoiceData } from '../app/components/InvoiceTemplate';
import type { CompanySettingsValues } from './companySettings';

const A4_PAGE: [number, number] = [595.28, 841.89];
const PAGE_MARGIN = 42;
const BODY_FONT_SIZE = 10.5;
const SECTION_GAP = 18;

const wrapText = (text: string, maxWidth: number, measure: (value: string) => number) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${currentLine} ${word}`;
    if (measure(candidate) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
};

export async function downloadInvoicePdf({
  invoice,
  companySettings,
}: {
  invoice: InvoiceData;
  companySettings: CompanySettingsValues;
}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(A4_PAGE);
  let { width, height } = page.getSize();
  let cursorY = height - PAGE_MARGIN;

  const ensureSpace = (spaceNeeded: number) => {
    if (cursorY - spaceNeeded > PAGE_MARGIN) return;
    page = pdfDoc.addPage(A4_PAGE);
    ({ width, height } = page.getSize());
    cursorY = height - PAGE_MARGIN;
  };

  const drawTextBlock = (
    label: string,
    value: string,
    options?: { x?: number; labelWidth?: number; width?: number }
  ) => {
    const x = options?.x ?? PAGE_MARGIN;
    const labelWidth = options?.labelWidth ?? 100;
    const contentWidth = options?.width ?? width - PAGE_MARGIN * 2 - labelWidth;
    const measure = (input: string) => regularFont.widthOfTextAtSize(input, BODY_FONT_SIZE);
    const lines = wrapText(value || '—', contentWidth, measure);
    const blockHeight = 16 + lines.length * 14;

    ensureSpace(blockHeight + 4);
    page.drawText(label, {
      x,
      y: cursorY,
      size: BODY_FONT_SIZE,
      font: boldFont,
      color: rgb(0.2, 0.23, 0.27),
    });
    let lineY = cursorY;
    for (const line of lines) {
      page.drawText(line, {
        x: x + labelWidth,
        y: lineY,
        size: BODY_FONT_SIZE,
        font: regularFont,
        color: rgb(0.07, 0.09, 0.15),
      });
      lineY -= 14;
    }
    cursorY = lineY - 2;
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(24);
    page.drawText(title, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 13,
      font: boldFont,
      color: rgb(0.04, 0.13, 0.22),
    });
    cursorY -= SECTION_GAP;
  };

  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: rgb(0.04, 0.13, 0.22),
  });

  page.drawText(companySettings.companyName, {
    x: PAGE_MARGIN,
    y: height - 52,
    size: 21,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Invoice ${invoice.invoiceNumber}`, {
    x: PAGE_MARGIN,
    y: height - 78,
    size: 12,
    font: regularFont,
    color: rgb(0.93, 0.96, 1),
  });

  cursorY = height - 145;

  drawTextBlock('Status', invoice.status);
  drawTextBlock('Invoice Date', new Date(invoice.date).toLocaleDateString('en-GB'));
  drawTextBlock('Due Date', new Date(invoice.dueDate).toLocaleDateString('en-GB'));
  drawTextBlock('Job Ref', invoice.jobRef);

  cursorY -= 6;
  drawSectionHeading('Company');
  drawTextBlock('Legal Name', companySettings.legalName || companySettings.companyName);
  drawTextBlock('Email', companySettings.email || '—');
  drawTextBlock('Phone', companySettings.phone || '—');
  drawTextBlock('Address', [companySettings.street, companySettings.city, companySettings.postcode].filter(Boolean).join(', ') || '—');

  cursorY -= 6;
  drawSectionHeading('Bill To');
  drawTextBlock('Client', invoice.clientName || '—');
  drawTextBlock('Email', invoice.clientEmail || '—');
  drawTextBlock('Address', invoice.clientAddress || '—');

  cursorY -= 6;
  drawSectionHeading('Service');
  drawTextBlock('Pickup', `${invoice.pickupLocation || '—'} ${invoice.pickupDateTime ? `(${new Date(invoice.pickupDateTime).toLocaleString('en-GB')})` : ''}`.trim());
  drawTextBlock('Delivery', `${invoice.deliveryLocation || '—'} ${invoice.deliveryDateTime ? `(${new Date(invoice.deliveryDateTime).toLocaleString('en-GB')})` : ''}`.trim());
  drawTextBlock('Recipient', invoice.deliveryRecipient || invoice.recipientName || '—');
  drawTextBlock('Description', invoice.serviceDescription || 'Delivery service');

  cursorY -= 6;
  drawSectionHeading('Totals');
  drawTextBlock('Net', `£${invoice.netAmount.toFixed(2)}`);
  drawTextBlock('VAT', `£${invoice.vatAmount.toFixed(2)} (${invoice.vatRate}%)`);
  drawTextBlock('Total', `£${invoice.amount.toFixed(2)}`);
  drawTextBlock('Terms', invoice.paymentTerms);
  drawTextBlock('Late Fee', invoice.lateFee || '—');

  const paymentMethods = [];
  if (companySettings.bankAccountName && companySettings.bankSortCode && companySettings.bankAccountNumber) {
    paymentMethods.push(
      `Bank transfer to ${companySettings.bankAccountName}, sort code ${companySettings.bankSortCode}, account ${companySettings.bankAccountNumber}.`
    );
  }
  if (companySettings.paypalEmail) {
    paymentMethods.push(`PayPal: ${companySettings.paypalEmail}.`);
  }

  cursorY -= 6;
  drawSectionHeading('Payment');
  drawTextBlock('Instructions', paymentMethods.join(' ') || 'Payment details available on request.');

  if (invoice.podPhotos?.length) {
    drawTextBlock('POD Photos', invoice.podPhotos.join(', '));
  }

  if (invoice.signature?.startsWith('data:image/')) {
    try {
      ensureSpace(90);
      const dataPart = invoice.signature.split(',')[1] ?? '';
      const imageBytes = Uint8Array.from(atob(dataPart), (char) => char.charCodeAt(0));
      const embeddedImage = invoice.signature.startsWith('data:image/png')
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);
      const scaled = embeddedImage.scale(0.25);
      page.drawText('Recipient Signature', {
        x: PAGE_MARGIN,
        y: cursorY,
        size: BODY_FONT_SIZE,
        font: boldFont,
        color: rgb(0.2, 0.23, 0.27),
      });
      cursorY -= 14;
      page.drawImage(embeddedImage, {
        x: PAGE_MARGIN,
        y: cursorY - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      cursorY -= scaled.height + 10;
    } catch {
      drawTextBlock('Recipient Signature', 'Signature captured in-app.');
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
