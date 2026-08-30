import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Driver assigned-job presentation consolidation contract', () => {
  it('keeps persisted multi-drop stops authoritative over the legacy two-point fallback', () => {
    const route = read('app/api/driver/mobile/jobs/route.ts');
    expect(route).toContain('const persistentStops = stopData.stopsByJob.get(row.id) ?? []');
    expect(route).toContain('stops: persistentStops.length > 0 ? persistentStops : operational.legacyStops');
  });

  it('adds signed private POD and load-document projections without raw storage paths', () => {
    const route = read('app/api/driver/mobile/jobs/route.ts');
    const pod = read('app/api/driver/mobile/podPresentation.ts');
    const attachments = read('app/api/driver/mobile/jobAttachmentPresentation.ts');
    expect(route).toContain('buildSignedPodPresentations');
    expect(route).toContain('buildSignedJobAttachments');
    expect(pod).toContain('createSignedUrls');
    expect(attachments).toContain(".from('load-documents')");
    expect(attachments).toContain('createSignedUrls');
    expect(attachments).not.toContain('file_path:');
  });

  it('keeps presentation outages partial rather than hiding the assigned job', () => {
    const route = read('app/api/driver/mobile/jobs/route.ts');
    expect(route).toContain('podPresentationPartial = true');
    expect(route).toContain('attachmentPresentationPartial = true');
    expect(route).toContain('multiDropPartial: stopData.partial');
  });
});
