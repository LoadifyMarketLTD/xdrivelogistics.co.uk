import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/web/jobs/[id]/evidence/route.ts'), 'utf8');

describe('collection evidence recovery GET security contract', () => {
  const get = source.slice(source.indexOf('export async function GET('), source.indexOf('export async function POST('));
  it('requires configured admin and enabled POD feature', () => {
    expect(get).toContain('isSupabaseAdminConfigured');
    expect(get).toContain("getFeatureFlag(supabaseAdmin, 'pod_capture')");
  });
  it('requires authenticated active driver and company context', () => {
    expect(get).toContain('requireActiveWebDriver(request)');
    expect(get).toContain('isWebDriverContext(driver)');
    expect(get).toContain('if (!driver.companyId)');
  });
  it('scopes accessible job to assigned driver', () => {
    expect(get).toContain(".eq('assigned_driver_id', driver.driverId).maybeSingle()");
    expect(get).toContain("if (!job) return respond(404");
  });
  it('limits listing to company and job collection documents', () => {
    expect(get).toContain('`${driver.companyId}/${id}/collection-documents`');
    expect(get).toContain("storage.from('pod-photos').list(folder");
    expect(get).toContain('SAFE_NAME.test(entry.name)');
    expect(get).toContain('Boolean(entry.id)');
  });
  it('does not leak backend error detail on failed reads', () => {
    expect(get).toContain("if (jobError) return respond(500, { error: 'Assigned job could not be resolved.' })");
    expect(get).toContain("if (error) return respond(500, { error: 'Collection documents could not be recovered.' })");
  });
});
