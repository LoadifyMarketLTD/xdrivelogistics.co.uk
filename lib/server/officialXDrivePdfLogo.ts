import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PDFDocument, PDFPage } from 'pdf-lib';

/**
 * The canonical platform logo approved for all newly generated official PDFs.
 * Never replace with a company logo, alternate wordmark or text-only fallback.
 * Historical signed documents must remain byte-for-byte immutable.
 */
export const OFFICIAL_XDRIVE_LOGO_FILENAME = 'xdrive-logo-company-3150.png';

export const officialXDriveLogoBytes = async (): Promise<Uint8Array> =>
  new Uint8Array(await readFile(path.join(process.cwd(), 'public', OFFICIAL_XDRIVE_LOGO_FILENAME)));

export async function drawOfficialXDrivePdfLogo(
  pdf: PDFDocument,
  page: PDFPage,
  options: { x: number; y: number; maxWidth?: number; maxHeight?: number },
): Promise<void> {
  const image = await pdf.embedPng(await officialXDriveLogoBytes());
  const scaled = image.scaleToFit(options.maxWidth ?? 204, options.maxHeight ?? 62);
  page.drawImage(image, {
    x: options.x,
    y: options.y,
    width: scaled.width,
    height: scaled.height,
  });
}
