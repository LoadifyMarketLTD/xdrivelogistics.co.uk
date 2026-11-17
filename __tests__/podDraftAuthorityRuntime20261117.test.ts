import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  job: {
    id: 'job-1',
    assigned_driver_id: 'driver-1',
    pod_generated: true,
    pod_generated_at: '2026-11-17T10:30:00Z',
    current_status: 'delivered',
    status: 'delivered',
    client_signature_name: 'Recipient',
    delivery_signature_data: { type: 'recipient_typed_name_attestation', value: 'Recipient' } as unknown,
    delivery_photos: ['carrier-1/job-1/photos/p.jpg'],
  },
  receipts: [] as Array<{ id: string; received_by: string }>,
  upserts: 0,
  drafts: 0,
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    from(table: string) {
      if (table === 'jobs') {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: state.job, error: null }),
        };
        return q;
      }
      if (table === 'proof_of_delivery') {
        const q = {
          select: () => q,
          eq: () => q,
          not: () => q,
          limit: async () => ({ data: state.receipts, error: null }),
        };
        return q;
      }
      if (table === 'driver_pod_drafts') {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => {
            state.drafts++;
            return { data: { form_data: { recipientName: 'Recipient' }, updated_at: '2026-11-17T10:30:00Z' }, error: null };
          },
          upsert: async () => { state.upserts++; return { error: null }; },
        };
        return q;
      }
      throw new Error('Unexpected table: ' + table);
    },
  },
}));
vi.mock('../app/api/driver/_lib/webDriverContext', () => ({
  requireActiveWebDriver: async () => ({ driverId: 'driver-1', companyId: 'carrier-1', userId: 'user-1' }),
  isWebDriverContext: () => true,
}));
import { GET, PUT } from '../app/api/driver/web/jobs/[id]/pod-draft/route';

const params = { params: Promise.resolve({ id: 'job-1' }) };
const drawn = 'data:image/png;base64,iVBORw0KGgoAAAAAA==';
const asRequest = (body?: unknown) => ({
  text: async () => JSON.stringify(body ?? {}),
}) as NextRequest;

describe('authenticated Driver POD draft runtime: false completion / safe recovery', () => {
  beforeEach(() => {
    state.job.current_status = 'delivered';
    state.job.status = 'delivered';
    state.job.pod_generated = true;
    state.job.pod_generated_at = '2026-11-17T10:30:00Z';
    state.job.client_signature_name = 'Recipient';
    state.job.delivery_signature_data = { type: 'recipient_typed_name_attestation', value: 'Recipient' };
    state.job.delivery_photos = ['carrier-1/job-1/photos/p.jpg'];
    state.receipts = [];
    state.upserts = 0;
    state.drafts = 0;
  });
  it('never claims an old typed-only POD is completed', async () => {
    const response = (await GET(asRequest(), params))!;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ completed: false, needsRepair: true });
    expect(state.drafts).toBe(1);
  });
  it('retains complete:true only when signed evidence and a proof receipt both exist', async () => {
    state.job.delivery_signature_data = drawn;
    state.receipts = [{ id: 'pod-1', received_by: 'Recipient' }];
    const response = (await GET(asRequest(), params))!;
    expect(await response.json()).toEqual({ completed: true, draft: null });
    expect(state.drafts).toBe(0);
  });
  it('does not claim a stored signature with no official proof row is complete', async () => {
    state.job.delivery_signature_data = drawn;
    const response = (await GET(asRequest(), params))!;
    expect(await response.json()).toMatchObject({ completed: false, needsRepair: true });
  });
  it('allows an old incomplete Delivered POD to save its verified draft for correction', async () => {
    const response = (await PUT(asRequest({
      recipientName: 'Recipient',
      signatureData: drawn,
      photoUris: ['carrier-1/job-1/photos/p.jpg'],
    }), params))!;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.upserts).toBe(1);
  });
  it('rejects draft rewriting after a valid signed POD', async () => {
    state.job.delivery_signature_data = drawn;
    state.receipts = [{ id: 'pod-1', received_by: 'Recipient' }];
    const response = (await PUT(asRequest({ recipientName: 'Other' }), params))!;
    expect(response.status).toBe(409);
    expect(state.upserts).toBe(0);
  });
  it('rejects repair to a completed job even when its historic POD was incomplete', async () => {
    state.job.current_status = 'completed';
    const response = (await PUT(asRequest({ recipientName: 'Other' }), params))!;
    expect(response.status).toBe(409);
    expect(state.upserts).toBe(0);
  });
});
