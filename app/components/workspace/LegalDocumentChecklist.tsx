'use client';
import { buildControlledLegalDocument, type ControlledLegalDocumentCode, type LegalLanguage } from '../../../lib/legal/controlledLegalDocuments';
import { getLegalUiCopy } from '../../../lib/legal/legalUiCopy';
type Agreement = { code: string; label: string; href: string; version: string };
export default function LegalDocumentChecklist({ agreements, language, selected, onChange, editable }: {
  agreements: Agreement[]; language: LegalLanguage; selected: string[];
  onChange: (codes: string[]) => void; editable: boolean;
}) {
  const copy = getLegalUiCopy(language);
  return <div style={{ display: 'grid', gap: 10 }}>
    {agreements.map(agreement => {
      const document = buildControlledLegalDocument(agreement.code as ControlledLegalDocumentCode, language);
      return <article key={agreement.code} style={{ border: '1px solid #dbe3ee', borderRadius: 6, padding: 12, background: '#fff' }}>
        <details>
          <summary style={{ cursor: 'pointer', color: '#0B2F6B', fontWeight: 750, padding: '6px 0' }}>
            {copy.read} {agreement.label} <span style={{ fontWeight: 400 }}> - v{agreement.version}</span>
          </summary>
          <div aria-label={agreement.label} style={{ lineHeight: 1.7, fontSize: 14, padding: '12px 0', overflowWrap: 'anywhere' }}>
            <h3>{document.title}</h3><p>{document.intro}</p>
            {document.sections.map((section, index) => <section key={index}>
              <h4>{section.title}</h4><p style={{ whiteSpace: 'pre-line' }}>{section.body}</p>
            </section>)}
          </div>
        </details>
        {editable && <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, paddingTop: 10 }}>
          <input type="checkbox" checked={selected.includes(agreement.code)} onChange={event => onChange(event.target.checked
            ? [...new Set([...selected, agreement.code])] : selected.filter(code => code !== agreement.code))} />
          <span>{copy.readAndAccept} {agreement.label}, {copy.version.toLowerCase()} {agreement.version}.</span>
        </label>}
      </article>;
    })}
    <details style={{ border: '1px solid #dbe3ee', borderRadius: 6, padding: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{copy.readPrivacyPolicy}</summary>
      <div style={{ lineHeight: 1.7, fontSize: 14 }}>
        <p>{buildControlledLegalDocument('privacy_policy', language).intro}</p>
        {buildControlledLegalDocument('privacy_policy', language).sections.map((section, index) =>
          <section key={index}><h4>{section.title}</h4><p style={{ whiteSpace: 'pre-line' }}>{section.body}</p></section>)}
      </div>
    </details>
    {editable && <p style={{ margin: 0, color: '#475569', fontSize: 12 }}>
      {copy.unsignedDraftNotice}
    </p>}
  </div>;
}
