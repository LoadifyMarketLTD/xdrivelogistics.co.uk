import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isVerifiedOfficialPodComplete } from '../lib/server/verifiedPodCompletion';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const drawn = 'data:image/png;base64,iVBORw0KGgoAAAABBBB==';
const job = {
  pod_generated: true,
  pod_generated_at: '2026-11-17T10:30:00Z',
  client_signature_name: 'Recipient Example',
  delivery_signature_data: drawn,
  delivery_photos: ['carrier/job/photos/photo.jpg'],
};
function fakeDb(receipts: Array<{ id: string; received_by: string | null }>, fail = false) {
  const calls = { from: 0 };
  const result = { data: receipts, error: fail ? { message: 'Database unavailable' } : null };
  const client = {
    from(table: string) {
      calls.from++;
      expect(table).toBe('proof_of_delivery');
      return {
        select(columns: string) {
          expect(columns).toBe('id,received_by');
          return {
            eq(key: string, value: string) {
              expect([key, value]).toEqual(['job_id', 'job-1']);
              return {
                not() {
                  return { limit: async () => result };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('official POD completion is evidence + persisted receipt, not a status flag', () => {
  it('rejects generated=true with a typed signature without even reading receipts', async () => {
    const { client, calls } = fakeDb([{ id: 'proof-1', received_by: 'Recipient' }]);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', {
      ...job, delivery_signature_data: { type: 'recipient_typed_name_attestation', value: 'Recipient' },
    })).toBe(false);
    expect(calls.from).toBe(0);
  });
  it('rejects missing recipient, signature or delivery photos', async () => {
    const { client, calls } = fakeDb([{ id: 'proof-1', received_by: 'Recipient' }]);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', { ...job, delivery_photos: [] })).toBe(false);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', { ...job, client_signature_name: '' })).toBe(false);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', { ...job, delivery_signature_data: null })).toBe(false);
    expect(calls.from).toBe(0);
  });
  it('rejects malformed or duplicated photos even when a receipt exists', async () => {
    const { client } = fakeDb([{ id: 'proof-1', received_by: 'Recipient' }]);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', { ...job, delivery_photos: ['carrier/job/photos/doc.pdf'] })).toBe(false);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', { ...job, delivery_photos: [job.delivery_photos[0], job.delivery_photos[0]] })).toBe(false);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', { ...job, pod_generated_at: null })).toBe(false);
  });
  it('rejects generated=true without a real canonical proof receipt', async () => {
    const { client } = fakeDb([]);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', job)).toBe(false);
  });
  it('does not accept a blank received_by field', async () => {
    const { client } = fakeDb([{ id: 'proof-1', received_by: '  ' }]);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', job)).toBe(false);
  });
  it('accepts an actually signed, photographed and persisted canonical POD', async () => {
    const { client } = fakeDb([{ id: 'proof-1', received_by: 'Recipient' }]);
    expect(await isVerifiedOfficialPodComplete(client, 'job-1', job)).toBe(true);
  });
  it('fails closed if the official receipt lookup fails', async () => {
    const { client } = fakeDb([], true);
    await expect(isVerifiedOfficialPodComplete(client, 'job-1', job)).rejects.toThrow(
      'Official POD receipt could not be verified',
    );
  });
});

describe('repair is only for incomplete delivered jobs; no false positive from pod_generated', () => {
  it('rechecks the actual evidence on GET and permits an incomplete legacy draft', () => {
    const route = read('app/api/driver/web/jobs/[id]/pod-draft/route.ts');
    expect(route).toContain('await isVerifiedOfficialPodComplete(supabaseAdmin!, id, access.job)');
    expect(route).toContain('needsRepair: access.job.pod_generated === true');
    expect(route).toContain('completed: false');
    expect(route).toContain("if (status !== 'delivered')");
    expect(route).not.toContain('if (access.job.pod_generated) return respond(200, { draft: null, completed: true })');
  });
  it('routes incomplete old PODs through a guarded atomic repair, not an idempotent no-op', () => {
    for (const pathname of [
      'app/api/driver/mobile/jobs/[id]/[action]/route.ts',
      'app/api/driver/web/jobs/[id]/[action]/route.ts',
    ]) {
      const code = read(pathname);
      expect(code).toContain('isVerifiedOfficialPodComplete');
      expect(code).toContain("'repair_incomplete_driver_pod_atomic'");
      expect(code).toContain("currentStatus !== 'delivered'");
      expect(code).toContain('if (!verified) return respond(409');
    }
  });
  it('restricts the recovery migration to service role and blocks issued invoice changes', () => {
    const sql = read('supabase/migrations/20261117110543_repair_incomplete_signed_pod_atomic.sql');
    expect(sql).toContain('FROM public.invoices');
    expect(sql).toContain("NOT IN ('draft','void')");
    expect(sql).toContain("'delivered'");
    expect(sql).toContain('JOIN public.drivers d');
    expect(sql).toContain('v_valid_existing');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('TO service_role');
    expect(sql).not.toContain('DELETE FROM public.jobs');
  });
});
