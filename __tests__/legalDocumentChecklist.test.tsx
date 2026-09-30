import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LegalDocumentChecklist from '../app/components/workspace/LegalDocumentChecklist';
import { buildCurrentLegalRequirement } from '../lib/legal/legalAgreementState';
const agreements = buildCurrentLegalRequirement('customer_shipper', 'en').agreements;
describe('legal document reading and signing boundary', () => {
  it('renders readable native disclosure controls and one unchecked checkbox per agreement', () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(createElement(LegalDocumentChecklist, { agreements, language: 'en', selected: [], onChange, editable: true }));
    expect((html.match(/<details/g) ?? []).length).toBe(agreements.length + 1);
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(agreements.length);
    expect(html).not.toContain('checked=""');
    expect(html).toContain('Read Privacy Policy');
    expect(html).toContain('Reading a document does not accept it.');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('keeps recorded agreements readable without presenting new consent checkboxes', () => {
    const html = renderToStaticMarkup(createElement(LegalDocumentChecklist, { agreements, language: 'en', selected: [], onChange: vi.fn(), editable: false }));
    expect(html).toContain('<details'); expect(html).not.toContain('type="checkbox"');
  });
  it('guards deployment packaging of the two signing fonts', () => {
    const config = readFileSync('next.config.mjs', 'utf8');
    expect(config).toContain('outputFileTracingIncludes');
    expect(config).toContain('inter-latin-ext-{400,700}-normal.woff');
    expect(readFileSync('scripts/netlify-release-gate.mjs', 'utf8')).toContain('scripts/validate-legal-runtime-assets.mjs');
  });
});
