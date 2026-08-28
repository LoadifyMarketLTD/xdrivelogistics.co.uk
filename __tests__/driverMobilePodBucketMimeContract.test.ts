import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile POD bucket MIME compatibility', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const originalBucket = read('supabase/migrations/032_storage_buckets.sql');
  const pdfAlignment = read('supabase/migrations/20260828130500_driver_pod_pdf_bucket_mime.sql');
  const evidenceRoute = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');

  it('preserves the original tenant-scoped pod-photos bucket contract', () => {
    expect(originalBucket).toContain("'pod-photos'");
    expect(originalBucket).toContain("'image/jpeg'");
    expect(originalBucket).toContain("'image/png'");
    expect(originalBucket).toContain("'image/webp'");
  });

  it('adds PDF support without narrowing an unrestricted bucket', () => {
    expect(pdfAlignment).toContain("WHERE id = 'pod-photos'");
    expect(pdfAlignment).toContain("'application/pdf' = ANY(v_allowed_mime_types)");
    expect(pdfAlignment).toContain("array_append(v_allowed_mime_types, 'application/pdf')");
    expect(pdfAlignment).toContain('v_allowed_mime_types IS NOT NULL');
  });

  it('fails closed when the required bucket is absent', () => {
    expect(pdfAlignment).toContain("RAISE EXCEPTION 'Required storage bucket pod-photos does not exist'");
  });

  it('keeps API MIME acceptance compatible with the bucket migration', () => {
    expect(evidenceRoute).toContain("'application/pdf'");
    expect(evidenceRoute).toContain("'image/jpeg'");
    expect(evidenceRoute).toContain("'image/png'");
  });
});
