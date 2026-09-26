import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildControlledLegalDocument, CONTROLLED_LEGAL_VERSION, LEGAL_LANGUAGES } from '../lib/legal/controlledLegalDocuments';
import { buildCurrentLegalEvidence, buildCurrentLegalRequirement } from '../lib/legal/legalAgreementState';
import { REGISTRATION_LEGAL_CONFIG } from '../lib/legal/registrationAgreements';
import { buildRegistrationLegalEvidence } from '../lib/legal/registrationEvidence';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926144804_multilingual_legal_acceptance_snapshot.sql'),'utf8');
const accountApi = readFileSync(join(process.cwd(),'app/api/account/legal-agreements/route.ts'),'utf8');
const gate = readFileSync(join(process.cwd(),'app/register/RegistrationAgreementGate.tsx'),'utf8');

describe('multilingual controlled legal acceptance',()=>{
  it('supports exactly the five controlled legal languages',()=>{
    expect(LEGAL_LANGUAGES).toEqual(['en','ro','fr','es','pl']);
  });

  it('uses controlled version and routes for every registration agreement',()=>{
    for (const config of Object.values(REGISTRATION_LEGAL_CONFIG)) {
      for (const agreement of config.agreements) {
        expect(agreement.version).toBe(CONTROLLED_LEGAL_VERSION);
        expect(agreement.href).toMatch(/^\/legal\//);
      }
    }
  });

  it('creates different cryptographic document snapshots per translation',()=>{
    const en=buildCurrentLegalEvidence('customer_shipper','2026-09-26T12:00:00.000Z','en');
    const ro=buildCurrentLegalEvidence('customer_shipper','2026-09-26T12:00:00.000Z','ro');
    expect(en.acceptanceLanguage).toBe('en');
    expect(ro.acceptanceLanguage).toBe('ro');
    expect(en.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ro.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(en.evidenceHash).not.toBe(ro.evidenceHash);
    expect(en.agreements.every((item)=>item.language==='en' && /^[0-9a-f]{64}$/.test(item.documentHash))).toBe(true);
    expect(ro.agreements.every((item)=>item.language==='ro' && /^[0-9a-f]{64}$/.test(item.documentHash))).toBe(true);
    expect(en.agreements[0].documentHash).not.toBe(ro.agreements[0].documentHash);
  });

  it('binds requirement fingerprint to selected language and exact document hashes',()=>{
    const en=buildCurrentLegalRequirement('transport_broker','en');
    const pl=buildCurrentLegalRequirement('transport_broker','pl');
    expect(en.requirementFingerprint).not.toBe(pl.requirementFingerprint);
    expect(en.privacyDocumentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pl.privacyDocumentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds server-side registration evidence from the selected metadata language',()=>{
    const config=REGISTRATION_LEGAL_CONFIG.owner_operator;
    const acceptedAt='2026-09-26T12:00:00.000Z';
    const evidence=buildRegistrationLegalEvidence({
      registration_role:'owner_operator',
      legal_version:CONTROLLED_LEGAL_VERSION,
      legal_agreements_accepted_at:acceptedAt,
      legal_agreement_codes:config.agreements.map((a)=>a.code),
      legal_agreement_versions:Object.fromEntries(config.agreements.map((a)=>[a.code,a.version])),
      legal_authority_confirmed_at:acceptedAt,
      legal_role_declaration_confirmed_at:acceptedAt,
      privacy_acknowledged_at:acceptedAt,
      privacy_version:'2026-09-26',
      legal_acceptance_language:'fr',
    });
    expect(evidence?.acceptanceLanguage).toBe('fr');
    expect(evidence?.agreements.every((item)=>item.language==='fr')).toBe(true);
  });

  it('persists and database-validates the translation snapshot',()=>{
    expect(migration).toContain('acceptance_language text');
    expect(migration).toContain('privacy_document_hash text');
    expect(migration).toContain("acceptance_language IN ('en','ro','fr','es','pl')");
    expect(migration).toContain('validate_registration_legal_translation_snapshot');
    expect(migration).toContain("v_item->>'language' IS DISTINCT FROM NEW.acceptance_language");
    expect(migration).toContain("v_item->>'documentHash'");
  });

  it('requires language in reacceptance API and exposes language selector in registration UI',()=>{
    expect(accountApi).toContain('language: z.enum(LEGAL_LANGUAGES)');
    expect(accountApi).toContain('acceptance_language: evidence.acceptanceLanguage');
    expect(accountApi).toContain('privacy_document_hash: evidence.privacyDocumentHash');
    expect(gate).toContain('LEGAL_LANGUAGES.map');
    expect(gate).toContain('?lang=${language}');
  });

  it('renders every controlled language document deterministically',()=>{
    for (const lang of LEGAL_LANGUAGES) {
      const doc=buildControlledLegalDocument('carrier_fleet_terms',lang);
      expect(doc.language).toBe(lang);
      expect(doc.translationVersion).toBe(`${doc.version}-${lang}-1`);
      expect(doc.sections.length).toBeGreaterThan(3);
    }
  });
});
