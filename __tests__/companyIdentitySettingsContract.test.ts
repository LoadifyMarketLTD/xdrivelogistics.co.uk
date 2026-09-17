import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../app/admin/settings/page.tsx', import.meta.url), 'utf8');

describe('verified company identity settings contract', () => {
  it('does not allow Settings to overwrite the verified company number', () => {
    expect(page).toContain('Company Number');
    expect(page).toContain('readOnly aria-readonly="true"');
    expect(page).not.toContain('company_number: companyForm.companyNumber');
    expect(page).not.toContain('companyNumber: e.target.value');
  });
});