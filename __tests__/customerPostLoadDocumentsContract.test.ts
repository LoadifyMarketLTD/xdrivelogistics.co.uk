import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const form = read('app/components/workspace/LoadPostingForm.tsx');
const documentsRoute = read('app/api/admin/jobs/[id]/documents/route.ts');

describe('Customer Post Load document contract', () => {
  it('keeps browser upload limits aligned with server verification', () => {
    expect(form).toContain('MAX_DOCUMENT_FILES = 12');
    expect(form).toContain('MAX_DOCUMENT_BYTES = 20 * 1024 * 1024');
    expect(documentsRoute).toContain('MAX_DOCUMENT_BYTES = 20 * 1024 * 1024');
    expect(documentsRoute).toContain('documents: z.array');
    expect(documentsRoute).toContain('.min(1).max(12)');
  });

  it('persists truthful uploader role and generic load attachment type', () => {
    expect(documentsRoute).toContain('uploaded_by_role: admin.roleInCompany');
    expect(documentsRoute).toContain("doc_type: 'load_attachment'");
    expect(documentsRoute).toContain("file_type: 'load_attachment'");
    expect(documentsRoute).not.toContain("doc_type: 'admin_load_attachment'");
  });

  it('verifies exact company/job storage ownership before metadata insert', () => {
    expect(documentsRoute).toContain("const prefix = `${admin.companyId}/${jobId}/`");
    expect(documentsRoute).toContain(".eq('company_id', admin.companyId)");
    expect(documentsRoute).toContain("storage.from('load-documents')");
  });
});
