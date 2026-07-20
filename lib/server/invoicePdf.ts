import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type InvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  issuerName: string;
  issuerAddress?: string | null;
  issuerCompanyNumber?: string | null;
  issuerVatNumber?: string | null;
  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  pickupLocation?: string | null;
  deliveryLocation?: string | null;
  serviceDescription?: string | null;
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  totalAmount: number;
  currency: string;
  paymentTerms?: string | null;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const safeText = (value: string | null | undefined, fallback = 'Not provided') =>
  value?.trim() || fallback;

const wrapText = (text: string, maxChars = 82) => {
  const words = text.split(/\s+/).filter(Boolean);
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

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(11 / 255, 47 / 255, 107 / 255);
  const blue = rgb(29 / 255, 87 / 255, 216 / 255);
  const orange = rgb(245 / 255, 163 / 255, 0);
  const grey = rgb(90 / 255, 104 / 255, 125 / 255);
  const light = rgb(244 / 255, 246 / 255, 248 / 255);
  const dark = rgb(26 / 255, 31 / 255, 43 / 255);

  page.drawRectangle({ x: 0, y: 745, width: 595.28, height: 96.89, color: navy });
  page.drawText('XDRIVE', { x: 42, y: 792, size: 23, font: bold, color: rgb(1, 1, 1) });
  page.drawText('LOGISTICS', { x: 42, y: 770, size: 13, font: bold, color: orange });
  page.drawText('INVOICE', { x: 430, y: 784, size: 24, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.invoiceNumber, { x: 430, y: 764, size: 10, font: regular, color: rgb(0.85, 0.9, 1) });

  page.drawText(input.issuerName, { x: 42, y: 715, size: 13, font: bold, color: dark });
  let issuerY = 697;
  for (const line of wrapText(safeText(input.issuerAddress, ''), 55)) {
    if (line) page.drawText(line, { x: 42, y: issuerY, size: 9, font: regular, color: grey });
    issuerY -= 13;
  }
  if (input.issuerCompanyNumber) {
    page.drawText(`Company No: ${input.issuerCompanyNumber}`, { x: 42, y: issuerY, size: 9, font: regular, color: grey });
    issuerY -= 13;
  }
  if (input.issuerVatNumber) {
    page.drawText(`VAT: ${input.issuerVatNumber}`, { x: 42, y: issuerY, size: 9, font: regular, color: grey });
  }

  page.drawRectangle({ x: 330, y: 650, width: 223, height: 76, color: light });
  page.drawText('BILL TO', { x: 346, y: 708, size: 8, font: bold, color: blue });
  page.drawText(input.clientName, { x: 346, y: 690, size: 11, font: bold, color: dark });
  page.drawText(safeText(input.clientAddress, ''), { x: 346, y: 674, size: 8.5, font: regular, color: grey, maxWidth: 190 });
  if (input.clientEmail) page.drawText(input.clientEmail, { x: 346, y: 660, size: 8.5, font: regular, color: grey });

  page.drawText('Invoice date', { x: 42, y: 620, size: 8, font: bold, color: grey });
  page.drawText(input.invoiceDate, { x: 42, y: 604, size: 10, font: regular, color: dark });
  page.drawText('Due date', { x: 170, y: 620, size: 8, font: bold, color: grey });
  page.drawText(input.dueDate, { x: 170, y: 604, size: 10, font: regular, color: dark });
  page.drawText('Payment terms', { x: 298, y: 620, size: 8, font: bold, color: grey });
  page.drawText(safeText(input.paymentTerms, '14 days'), { x: 298, y: 604, size: 10, font: regular, color: dark });

  page.drawRectangle({ x: 42, y: 552, width: 511, height: 30, color: blue });
  page.drawText('SERVICE / ROUTE', { x: 54, y: 563, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: 485, y: 563, size: 9, font: bold, color: rgb(1, 1, 1) });

  const route = `${safeText(input.pickupLocation, 'Collection')} → ${safeText(input.deliveryLocation, 'Delivery')}`;
  let itemY = 526;
  for (const line of wrapText(route, 78)) {
    page.drawText(line, { x: 54, y: itemY, size: 10, font: bold, color: dark });
    itemY -= 15;
  }
  for (const line of wrapText(safeText(input.serviceDescription, 'Logistics / delivery service'), 78)) {
    page.drawText(line, { x: 54, y: itemY, size: 9, font: regular, color: grey });
    itemY -= 13;
  }
  page.drawText(money(input.netAmount, input.currency), { x: 475, y: 526, size: 10, font: bold, color: dark });
  page.drawLine({ start: { x: 42, y: itemY - 5 }, end: { x: 553, y: itemY - 5 }, thickness: 1, color: light });

  const totalsX = 355;
  let totalsY = Math.min(itemY - 45, 430);
  const totalRows: Array<[string, string, boolean]> = [
    ['Net', money(input.netAmount, input.currency), false],
    [`VAT (${input.vatRate}%)`, money(input.vatAmount, input.currency), false],
    ['TOTAL', money(input.totalAmount, input.currency), true],
  ];
  for (const [label, value, isTotal] of totalRows) {
    if (isTotal) page.drawRectangle({ x: totalsX - 10, y: totalsY - 8, width: 208, height: 30, color: navy });
    page.drawText(label, { x: totalsX, y: totalsY, size: isTotal ? 11 : 9, font: bold, color: isTotal ? rgb(1, 1, 1) : grey });
    page.drawText(value, { x: 475, y: totalsY, size: isTotal ? 11 : 9, font: bold, color: isTotal ? rgb(1, 1, 1) : dark });
    totalsY -= 34;
  }

  page.drawLine({ start: { x: 42, y: 90 }, end: { x: 553, y: 90 }, thickness: 1, color: light });
  page.drawText('Thank you for choosing XDrive Logistics.', { x: 42, y: 68, size: 9, font: bold, color: navy });
  page.drawText('Move Freight. Manage Operations. Grow Your Network.', { x: 42, y: 51, size: 8, font: regular, color: grey });

  return pdf.save();
}
