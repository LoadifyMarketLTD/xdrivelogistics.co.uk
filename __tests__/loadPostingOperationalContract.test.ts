import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const form = fs.readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const createApi = fs.readFileSync(path.join(root, 'app/api/jobs/create/route.ts'), 'utf8');
const source = `${form}\n${createApi}`;

const requiredOperationalConcepts = [
  ['pickup', ['pickupAddress', 'pickupPostcode', 'pickupDateTime']],
  ['delivery', ['deliveryAddress', 'deliveryPostcode', 'deliveryDateTime']],
  ['collection contact', ['collectionContact', 'collectionPhone', 'collection_contact_name', 'collection_contact_phone']],
  ['delivery contact', ['deliveryContact', 'deliveryPhone', 'delivery_contact_name', 'delivery_contact_phone']],
  ['customer reference', ['customerReference', 'customer_reference']],
  ['purchase order', ['purchaseOrder', 'purchase_order_number']],
  ['customer booking reference', ['bookingReference', 'booking_reference']],
  ['vehicle', ['vehicleLabel', 'vehicle_type']],
  ['cargo', ['cargoLabel', 'cargo_type']],
  ['weight', ['weightKg', 'weight_kg']],
  ['pallets', ['pallets']],
  ['tail lift', ['tailLift', 'collection_tail_lift_required']],
  ['forklift', ['forklift', 'collection_forklift_available']],
  ['handball', ['handball', 'collection_handball_required']],
  ['public quote notes', ['publicQuoteNotes']],
  ['private execution instructions', ['executionInstructions']],
] as const;

describe('load posting operational contract', () => {
  it.each(requiredOperationalConcepts)('keeps %s represented by the Post Load form/API contract', (_label, tokens) => {
    for (const token of tokens) expect(source).toContain(token);
  });

  it('keeps platform identity automatic and customer references explicit', () => {
    expect(form).toContain('Posting identity & XDrive references');
    expect(form).toContain('Member ID');
    expect(form).toContain('Generated automatically after save / publish');
    expect(form).toContain('Customer booking reference (optional)');
    expect(form).toContain('XDL-');
  });

  it('surfaces the server diagnostic reference without exposing database details', () => {
    expect(form).toContain('referenceId?: string');
    expect(form).toContain('Error reference:');
    expect(createApi).toContain('operationalError');
  });

  it('makes centimetre storage explicit for load dimensions', () => {
    expect(form).toContain('Values are stored in centimetres');
    expect(form).toContain('for 4 m enter 400');
    expect(source).toContain('lengthCm');
    expect(source).toContain('widthCm');
    expect(source).toContain('heightCm');
  });

  it('keeps public quote notes distinct from private execution instructions', () => {
    expect(source).toContain('publicQuoteNotes');
    expect(source).toContain('executionInstructions');
    expect(source.indexOf('publicQuoteNotes')).not.toBe(source.indexOf('executionInstructions'));
  });

  it('does not claim unsupported POD-entry controls are part of the current Post Load form contract', () => {
    expect(form).not.toMatch(/name=["']pod|set\(['"]pod/i);
  });
});
