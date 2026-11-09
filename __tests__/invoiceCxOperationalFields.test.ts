import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadInvoicePdfContext } from '../lib/server/invoicePdfContext';
import { buildInvoicePdf } from '../lib/server/invoicePdf';
import { PDFDocument } from 'pdf-lib';

describe('CX operational information integrated in XDrive official invoice', () => {
  it('uses the actual delivered event and signed POD handover, not a scheduled delivery slot', async () => {
    const fixtures:Record<string,unknown> = {
      companies: {email:null,phone:null,website:null,logo_url:null},
      company_settings: {bank_account_name:null,bank_sort_code:null,bank_account_number:null,paypal_email:null},
      jobs: {
        id:'job-test', pod_generated:true, pod_photos:[], delivery_photos:['company-test/job-test/delivery.jpg'],
        pickup_datetime:'2026-11-09T09:00:00Z',
        delivery_datetime:'2026-11-11T15:00:00Z',
        delivered_at:'2026-11-09T20:24:04Z',
        delivery_notes:'Instructions at delivery',
        items:2, vehicle_type:'luton_van',
        pallets:null,boxes:null,bags:null,weight_kg:null,cargo_type:null,
        collection_photo_url:null,delivery_signature_data:'data:image/png;base64,AA==',client_signature_name:'XDrive Logistics',
      },
      driver_pod_drafts: {form_data: {leftAt:'Goods Inwards',notes:'Signed handover note'}},
    };
    const client = {
      storage:{from(){return {async download(){return {data:new Blob([new Uint8Array([137,80,78,71])]),error:null};}};}},
      from(table:string) {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          async maybeSingle() { return {data:fixtures[table]??null,error:null}; },
        };
      },
    } as unknown as SupabaseClient;
    const result=await loadInvoicePdfContext({supabase:client,companyId:'company-test',jobId:'job-test'});
    expect(result.deliveryDateTime).toBe('2026-11-11T15:00:00Z');
    expect(result.deliveredAt).toBe('2026-11-09T20:24:04Z');
    expect(result.leftAt).toBe('Goods Inwards');
    expect(result.deliveryNotes).toBe('Signed handover note');
    expect(result.recipientName).toBe('XDrive Logistics');
    // An unfinished POD must never be represented as a confirmed handover.
    (fixtures.jobs as Record<string, unknown>).pod_generated = false;
    const unconfirmed=await loadInvoicePdfContext({supabase:client,companyId:'company-test',jobId:'job-test'});
    expect(unconfirmed.leftAt).toBeNull();
    expect(unconfirmed.deliveryNotes).toBeNull();
  });
  it('maps the same official POD values into both preview and email export', () => {
    for (const f of ['app/api/driver/finance/invoices/[id]/preview/route.ts','lib/server/invoiceDelivery.ts']) {
      const src=fs.readFileSync(f,'utf8');
      expect(src).toContain('leftAt: pdfContext.leftAt ||');
      expect(src).toContain('deliveryNotes: pdfContext.deliveryNotes ||');
      expect(src).toContain('deliveredAt: pdfContext.deliveredAt ||');
    }
  });
  it('preserves approved branding and adds CX information without changing financial calculations',async () => {
    const bytes=await buildInvoicePdf({
      invoiceNumber:'INV-202611-003',jobReference:'XDL-090CD41C',invoiceDate:'2026-11-09',
      dueDate:'2026-11-30',issuerName:'XDrive Logistics',clientName:'Customer - layout preview',
      pickupLocation:'Blackburn BB1',deliveryLocation:'Bexley DA8',
      orderedAt:'2026-11-08T14:30:00Z',
      pickupDateTime:'2026-11-09T12:30:00Z',
      deliveryDateTime:'2026-11-11T15:00:00Z',
      deliveredAt:'2026-11-09T20:24:04Z',
      recipientName:'XDrive Logistics',leftAt:'Goods Inwards',
      deliveryNotes:'Delivery accepted; 2 items received and checked.',
      vehicleDescription:'Luton van',cargoDescription:'2 items',
      logoBytes:new Uint8Array(fs.readFileSync('public/xdrive-logo-primary.png')),
      netAmount:17,vatAmount:0,vatRate:0,vatTreatment:'not_registered',
      totalAmount:17,currency:'GBP',paymentTerms:'End of calendar month',
    });
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28,1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89,1);
    const src=fs.readFileSync('lib/server/invoicePdf.ts','utf8');
    for(const field of ['input.orderedAt','input.deliveredAt','input.recipientName','input.leftAt','input.deliveryNotes'])expect(src).toContain(field);
    expect(src).toContain('money(finiteMoney(input.totalAmount),input.currency)');
    fs.writeFileSync('invoice-cx-fields-preview.pdf',bytes);
  });
});
