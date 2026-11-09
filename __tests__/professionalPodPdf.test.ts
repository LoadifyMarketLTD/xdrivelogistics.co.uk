import { describe,it,expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { drawOfficialPodCover,tidyPodAddress } from '../lib/server/professionalPodPdf';

describe('XDrive professional official POD A4',()=>{
 it('keeps the genuine platform logo and A4 professional layout',async()=>{
  const pdf=await PDFDocument.create();
  const logo=fs.readFileSync(path.join(process.cwd(),'public/xdrive-logo-primary.png'));
  const fakeSignature=await sharp(Buffer.from('<svg width="420" height="110" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><path d="M 20 80 Q 75 15 105 75 T 190 60 Q 240 3 280 45 T 398 60" stroke="#15314e" stroke-width="4" fill="none"/></svg>')).png().toBuffer();
  await drawOfficialPodCover(pdf,logo,'XDrive Logistics',{
   id:'090cd41c-b6d7-43b5-bfe9-20126bc65004',reference:'XDL-090CD41C',
   pickup_location:'Cornelian Street, Blackburn, BB1 9QL, GB, BB1 9QL',
   delivery_location:'Holly Hill Road, London Borough of Bexley, DA8 1QD, GB, DA8 1QD',
   pickup_datetime:'2026-11-09T12:30:00Z',delivery_datetime:'2026-11-12T12:30:00Z',
   pod_generated_at:'2026-11-09T20:24:04Z',collection_contact_name:'DAN',
   delivery_contact_name:'DANIEL',client_signature_name:'XDrive Logistics',no_of_items:2,
  },'data:image/png;base64,'+fakeSignature.toString('base64'),4,{leftAt:'Goods Inwards',itemCount:'2',deliveryStatus:'Completed Delivery'});
  const data=await pdf.save();const roundtrip=await PDFDocument.load(data);
  expect(roundtrip.getPageCount()).toBe(1);
  expect(roundtrip.getPage(0).getWidth()).toBeCloseTo(595.28,1);
  expect(roundtrip.getPage(0).getHeight()).toBeCloseTo(841.89,1);
  expect(data.byteLength).toBeGreaterThan(12000);
  const output=path.join(process.cwd(),'pod-professional-visual-qa.pdf');
  fs.writeFileSync(output,data);
 });
 it('does not duplicate UK postcodes in the displayed job addresses',()=>{
   expect(tidyPodAddress('Cornelian Street, Blackburn, BB1 9QL, GB, BB1 9QL')).toBe('Cornelian Street, Blackburn, BB1 9QL');
   expect(tidyPodAddress('Holly Hill Road, Bexley, DA8 1QD, GB, DA8 1QD')).toBe('Holly Hill Road, Bexley, DA8 1QD');
 });
 it('keeps authentication and canonical evidence checks in the issuing route',()=>{
   const route=fs.readFileSync(path.join(process.cwd(),'app/api/workspace/jobs/[jobId]/pod/pdf/route.ts'),'utf8');
   expect(route).toContain('getBearerToken(request)');
   expect(route).toContain('canonicalPodEvidence(job)');
   expect(route).toContain('if (!evidence.complete)');
   expect(route).toContain('drawOfficialPodCover(pdf, logoBytes');
   expect(route).toContain("'xdrive-logo-primary.png'");
 });
});