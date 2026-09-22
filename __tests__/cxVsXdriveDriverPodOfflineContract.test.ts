import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Driver POD server consolidation contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const evidence = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
  const lifecycle = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const detail = read('app/api/driver/mobile/jobs/[id]/route.ts');
  const damageMigration = read('supabase/migrations/20260830004958_port_driver_pod_damage_evidence.sql');

  it('stages delivery evidence under company/job/category and only links collection evidence during upload', () => {
    expect(evidence).toContain("type EvidenceCategory = 'photos' | 'damage' | 'documents'");
    expect(evidence).toContain('driver.companyId');
    expect(evidence).toContain('category');
    expect(evidence).toContain('objectName');
    expect(evidence).toContain("if (kind === 'collection')");
    expect(evidence).not.toContain('delivery_photos: Array.from');
    expect(evidence).not.toContain('damage_photos: Array.from');
    expect(evidence).not.toContain('pod_photos: Array.from');
  });

  it('makes lifecycle transitions consume persisted server evidence while preserving the multi-drop final gate', () => {
    expect(lifecycle).toContain('p_collection_photo_url: null');
    expect(lifecycle).toContain('p_delivery_photos: null');
    expect(lifecycle).toContain('p_delivery_signature_data: null');
    expect(lifecycle).toContain('p_client_signature_name: null');
    expect(lifecycle).toContain('requireMultiDropFinalizationReady');
    expect(lifecycle).toContain('Complete all multi-drop stops before capturing POD or marking the job delivered.');
    expect(lifecycle).toContain('damage_photos: Array.from(new Set([...existingDamagePhotos, ...damagePhotoPaths]))');
  });

  it('keeps damage evidence first-class in production schema and projects signed POD through the mobile job detail API', () => {
    expect(damageMigration).toContain('ADD COLUMN IF NOT EXISTS damage_photos jsonb');
    expect(detail).toContain('buildSignedPodPresentations');
    expect(detail).toContain('damage_photos,pod_generated_at,driver_notes');
    expect(detail).toContain('podCompleted: Boolean(pod)');
  });

  it('keeps evidence mutations behind the authenticated assigned-driver server route', () => {
    expect(evidence).toContain('const driver = await requireDriver(request)');
    expect(evidence).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(evidence).toContain("request.headers.get('x-xdrive-evidence-kind')");
    expect(evidence).toContain("request.headers.get('x-xdrive-evidence-category')");
  });
});
