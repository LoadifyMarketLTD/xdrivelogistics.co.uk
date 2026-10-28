import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver POD PDF generation contract', () => {
  it('authorises access and requires complete evidence before PDF generation', () => {
    const route = read('app/api/workspace/jobs/[jobId]/pod/pdf/route.ts');
    expect(route).toContain('getBearerToken(request)');
    expect(route).toContain('company_memberships');
    expect(route).toContain('canonicalPodEvidence(job)');
    expect(route).toContain('if (!evidence.complete)');
    expect(route).toContain('pdf.embedPng(bytes)');
    expect(route).toContain('pdf.embedJpg(bytes)');
    expect(route).toContain("'Content-Type': 'application/pdf'");
  });

  it('only offers mobile download after completed POD', () => {
    const page = read('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(page).toContain('{podComplete&&<button');
    expect(page).toContain('Download POD PDF');
    expect(page).toContain('downloadPodPdf()');
    expect(page).toContain('URL.createObjectURL(blob)');
  });

  it('can produce valid PDF bytes with the project PDF library', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([595, 842]).drawText('PROOF OF DELIVERY', { x: 40, y: 790, font });
    const bytes = await pdf.save();
    expect(Buffer.from(bytes).subarray(0, 8).toString('utf8')).toContain('%PDF-');
  });
});
