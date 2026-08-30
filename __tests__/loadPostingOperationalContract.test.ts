import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const form = fs.readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const createApi = fs.readFileSync(path.join(root, 'app/api/jobs/create/route.ts'), 'utf8');
const publishComplianceRepair = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260829221052_repair_job_publish_compliance_and_idempotency.sql'),
  'utf8',
);
const source = `${form}\n${createApi}`;

const requiredOperationalConcepts = [
  ['pickup', ['pickupAddress', 'pickupPostcode', 'pickupDateTime']],
  ['delivery', ['deliveryAddress', 'deliveryPostcode', 'deliveryDateTime']],
  ['collection contact', ['collectionContact', 'collectionPhone', 'collection_contact_name', 'collection_contact_phone']],
  ['delivery contact', ['deliveryContact', 'deliveryPhone', 'delivery_contact_name', 'delivery_contact_phone']],
  ['additional stops', ['Additional stops', 'additionalStops', 'job_stops']],
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
    expect(form).toContain('Company number');
    expect(form).toContain('Generated automatically after save / publish');
    expect(form).toContain('Customer booking reference (optional)');
    expect(form).toContain('XDL-');
  });

  it('surfaces the server diagnostic reference without exposing database details', () => {
    expect(form).toContain('referenceId?: string');
    expect(form).toContain('Error reference:');
    expect(createApi).toContain('operationalError');
  });

  it('uses centimetres end-to-end for load dimensions', () => {
    expect(form).toContain('Length (cm)');
    expect(form).toContain('Width (cm)');
    expect(form).toContain('Height (cm)');
    expect(form).toContain('Dimensions are entered and stored in centimetres (cm).');
    expect(form).toContain('lengthCm: numberOrNull(form.length)');
    expect(form).toContain('widthCm: numberOrNull(form.width)');
    expect(form).toContain('heightCm: numberOrNull(form.height)');
    expect(form).not.toContain('metresToCm');
    expect(form).not.toContain('Length (m)');
  });

  it('highlights invalid required fields and focuses the first invalid field after submit', () => {
    expect(form).toContain('setShowValidation(true)');
    expect(form).toContain('Complete the fields highlighted in red.');
    expect(form).toContain("aria-invalid={errors?.postcode ? 'true' : undefined}");
    expect(form).toContain("aria-invalid={errors?.address ? 'true' : undefined}");
    expect(form).toContain("document.querySelector<HTMLElement>('[aria-invalid=\"true\"]')");
    expect(form).toContain("'#dc2626'");
  });

  it('uses only future half-hour booking slots instead of arbitrary native time input', () => {
    expect(form).toContain('const HALF_HOUR_SLOTS = Array.from({ length: 48 }');
    expect(form).toContain("/^(\\d{2}):(00|30)$/");
    expect(form).toContain('minutes * 60 > currentSeconds');
    expect(form).toContain('Choose a future 30-minute slot');
    expect(form).toContain('No future times remain today — choose tomorrow.');
    expect(form).not.toContain('30-minute slots only.');
    expect(form).toContain('min={minDate}');
    expect(form).not.toContain('type="time"');
  });

  it('keeps publish separate from carrier execution compliance and restores create idempotency', () => {
    expect(publishComplianceRepair).toContain("if lower(coalesce(p_context, '')) = 'publish' then");
    expect(publishComplianceRepair).toContain('return v_issues;');
    expect(publishComplianceRepair).toContain('add column if not exists creation_idempotency_key text');
    expect(publishComplianceRepair).toContain('jobs_company_creation_idempotency_uidx');
    expect(createApi).toContain(".eq('creation_idempotency_key', input.idempotencyKey)");
  });

  it('keeps capability-labelled vehicle choices consistent with stored requirements', () => {
    expect(form).toContain("value === 'Luton Tail Lift' ? true");
    expect(form).toContain("value === 'ADR Vehicle' ? true");
    expect(form).toContain("value === 'Refrigerated Vehicle' || value === 'Artic 44T Refrigerated'");
    expect(form).toContain('Tail lift required');
    expect(form).toContain('Forklift available at collection');
    expect(form).toContain('Handball required');
    expect(createApi).toContain("input.forklift && 'Forklift available at collection'");
    expect(createApi).not.toContain("input.forklift && 'Forklift required'");
  });

  it('keeps public quote notes distinct from private execution instructions', () => {
    expect(source).toContain('publicQuoteNotes');
    expect(source).toContain('executionInstructions');
    expect(source.indexOf('publicQuoteNotes')).not.toBe(source.indexOf('executionInstructions'));
  });

  it('keeps exact multi-drop stop details private while exposing only a safe stop count to pricing context', () => {
    expect(form).toContain('Exact stop details stay private before award.');
    expect(createApi).toContain('additionalStopCount: input.additionalStops.length');
    expect(createApi).toContain(".from('job_stops')");
    expect(createApi).not.toContain('additionalStops: input.additionalStops');
  });

  it('does not claim unsupported POD-entry controls are part of the current Post Load form contract', () => {
    expect(form).not.toMatch(/name=["']pod|set\(['"]pod/i);
  });
});
