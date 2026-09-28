import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = path.join(process.cwd(), 'supabase', 'migrations');
const file = fs.readdirSync(dir).find((name) => name.endsWith('_harden_onboarding_and_pod_storage_buckets.sql'));
if (!file) throw new Error('Storage bucket hardening migration is missing.');
const sql = fs.readFileSync(path.join(dir, file), 'utf8');

describe('storage bucket upload boundary hardening', () => {
  it('caps onboarding documents at the server-validated 10 MB boundary', () => {
    expect(sql).toContain("WHERE id = 'onboarding-documents'");
    expect(sql).toContain('file_size_limit = 10485760');
    expect(sql).toContain("'application/pdf','image/jpeg','image/png','image/webp'");
  });

  it('caps POD photos at 15 MB and image MIME types only', () => {
    expect(sql).toContain("WHERE id = 'pod-photos'");
    expect(sql).toContain('file_size_limit = 15728640');
    expect(sql).toContain("'image/jpeg','image/png','image/webp'");
  });

  it('fails closed if bucket limits are not applied', () => {
    expect(sql).toContain('Storage bucket upload limits were not applied.');
  });
});
