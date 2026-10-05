import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildControlledLegalDocument, CONTROLLED_LEGAL_VERSION, isRtlLegalLanguage, LEGAL_LANGUAGES } from '../lib/legal/controlledLegalDocuments';
import { buildCurrentLegalEvidence, buildCurrentLegalRequirement } from '../lib/legal/legalAgreementState';
import { getRegistrationLegalConfig, REGISTRATION_LEGAL_CONFIG } from '../lib/legal/registrationAgreements';
import { buildRegistrationLegalEvidence } from '../lib/legal/registrationEvidence';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926144804_multilingual_legal_acceptance_snapshot.sql'),'utf8');
const languageExtensionMigration = readFileSync(join(process.cwd(),'supabase/migrations/20261004002110_extend_legal_languages_and_comprehension.sql'),'utf8');
const controlledPage = readFileSync(join(process.cwd(),'app/components/legal/ControlledLegalDocumentPage.tsx'),'utf8');
const accountApi = readFileSync(join(process.cwd(),'app/api/account/legal-agreements/route.ts'),'utf8');
const gate = readFileSync(join(process.cwd(),'app/register/RegistrationAgreementGate.tsx'),'utf8');
const signedPersistence = readFileSync(join(process.cwd(),'lib/legal/persistSignedLegalAcceptance.ts'),'utf8');

describe('multilingual controlled legal acceptance',()=>{
  it('supports the eleven controlled legal language variants',()=>{
    expect(LEGAL_LANGUAGES).toEqual(['en','ro','fr','es','pl','ur','pa-guru','pa-shah','hi','bn','gu']);
    expect(isRtlLegalLanguage('ur')).toBe(true);
    expect(isRtlLegalLanguage('pa-shah')).toBe(true);
    expect(isRtlLegalLanguage('pa-guru')).toBe(false);
    expect(isRtlLegalLanguage('hi')).toBe(false);
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
      legal_language_comprehension_confirmed_at:acceptedAt,
    });
    expect(evidence?.acceptanceLanguage).toBe('fr');
    expect(evidence?.agreements.every((item)=>item.language==='fr')).toBe(true);
  });

  it('persists and database-validates the translation snapshot',()=>{
    expect(migration).toContain('acceptance_language text');
    expect(migration).toContain('privacy_document_hash text');
    expect(migration).toContain("acceptance_language IN ('en','ro','fr','es','pl')");
    expect(languageExtensionMigration).toContain("'ur','pa-guru','pa-shah','hi','bn','gu'");
    expect(languageExtensionMigration).toContain('language_comprehension_confirmed_at timestamptz');
    expect(languageExtensionMigration).toContain('language_comprehension_confirmed_at = accepted_at');
    expect(migration).toContain('validate_registration_legal_translation_snapshot');
    expect(migration).toContain("v_item->>'language' IS DISTINCT FROM NEW.acceptance_language");
    expect(migration).toContain("v_item->>'documentHash'");
  });

  it('requires language in reacceptance API and exposes language selector in registration UI',()=>{
    expect(accountApi).toContain('language: z.enum(LEGAL_LANGUAGES)');
    expect(accountApi).toContain('languageComprehensionConfirmed: z.literal(true)');
    expect(accountApi).toContain('persistSignedLegalAcceptance');
    expect(signedPersistence).toContain('acceptance_language: input.evidence.acceptanceLanguage');
    expect(signedPersistence).toContain('privacy_document_hash: input.evidence.privacyDocumentHash');
    expect(signedPersistence).toContain('language_comprehension_confirmed_at: input.evidence.acceptedAt');
    expect(gate).toContain('LEGAL_LANGUAGES.map');
    expect(gate).toContain('languageComprehensionConfirmed');
    expect(gate).toContain('languageComprehensionConfirmation');
    expect(gate).toContain('?lang=${language}');
    expect(gate).toContain("dir={isRtlLegalLanguage(language) ? 'rtl' : 'ltr'}");
    expect(controlledPage).toContain("dir={isRtlLegalLanguage(language) ? 'rtl' : 'ltr'}");
  });

  it('binds explicit read-and-understand language declarations into every signed evidence language',()=>{
    for (const lang of LEGAL_LANGUAGES) {
      const requirement=buildCurrentLegalRequirement('owner_operator',lang);
      const evidence=buildCurrentLegalEvidence('owner_operator','2026-09-26T12:00:00.000Z',lang);
      expect(requirement.acceptanceStatement).toBe(evidence.acceptanceStatement);
      expect(requirement.acceptanceStatement.length).toBeGreaterThan(70);
      expect(requirement.requirementFingerprint).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('builds native-script controlled documents for the added South Asian languages',()=>{
    const samples = [
      ['ur','اردو'],
      ['pa-guru','ਪੰਜਾਬੀ'],
      ['pa-shah','پنجابی'],
      ['hi','हिन्दी'],
      ['bn','বাংলা'],
      ['gu','ગુજરાતી'],
    ] as const;
    for (const [lang, label] of samples) {
      const doc=buildControlledLegalDocument('platform_terms',lang);
      const requirement=buildCurrentLegalRequirement('owner_operator',lang);
      expect(doc.language).toBe(lang);
      expect(doc.translationVersion).toBe(`${doc.version}-${lang}-1`);
      expect(doc.title.length).toBeGreaterThan(8);
      expect(doc.sections.length).toBeGreaterThanOrEqual(7);
      expect(requirement.acceptanceStatement.length).toBeGreaterThan(70);
      expect(requirement.requirementFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it('includes the material transport-buyer controls in every controlled language',()=>{
    for (const lang of LEGAL_LANGUAGES) {
      const marketplace=buildControlledLegalDocument('marketplace_transport_terms',lang);
      expect(marketplace.sections.some((section)=>section.body.includes('£2,500'))).toBe(true);
      expect(marketplace.sections.some((section)=>section.body.includes('3 '))).toBe(true);
      expect(marketplace.sections.length).toBeGreaterThanOrEqual(11);
    }
    const ro=buildCurrentLegalRequirement('customer_shipper','ro');
    expect(ro.acceptanceStatement).toContain('Confirm că pot citi și înțelege limba română');
    expect(ro.acceptanceStatement).toContain('Am citit integral acordurile XDrive');
    expect(ro.authorityStatement).toContain('Confirm că sunt autorizat');
    expect(ro.privacyStatement).toContain('Politicii de Confidențialitate');
    const roMarketplace=buildControlledLegalDocument('marketplace_transport_terms','ro');
    expect(roMarketplace.sections.some((section)=>section.title.includes('Controale de risc și expunere'))).toBe(true);
    expect(roMarketplace.sections.every((section)=>!section.title.includes('Transport buyer risk and exposure controls'))).toBe(true);
  });

  it('renders Romanian legal labels and section headings in Romanian when Romanian is selected',()=>{
    const config=getRegistrationLegalConfig('owner_operator','ro');
    expect(config.agreements.map((item)=>item.label)).toEqual([
      'Termenii Platformei XDrive',
      'Termeni Owner Driver / Transportator',
      'Termeni Comerciali Marketplace și Transport',
      'Termeni de Membru și Abonament',
    ]);
    const membership=buildControlledLegalDocument('membership_subscription_terms','ro');
    expect(membership.sections.map((section)=>section.title)).toEqual([
      '1. Eligibilitate și acces',
      '2. Perioade gratuite și plătite',
      '3. Reînnoire și anulare',
      '4. Tarife de transport',
    ]);
    const privacy=buildControlledLegalDocument('privacy_policy','ro');
    expect(privacy.sections[0].title).toBe('1. Datele pe care le prelucrăm');
    expect(privacy.sections[1].title).toBe('2. Date privind operațiunile de transport');
    const owner=buildControlledLegalDocument('owner_driver_terms','ro');
    expect(owner.sections.some((section)=>section.title.includes('Conformitatea transportatorului'))).toBe(true);
    expect(owner.sections.some((section)=>section.title.includes('Amendamente și costuri suplimentare aprobate'))).toBe(true);
    expect(owner.sections.every((section)=>!section.title.includes('Carrier compliance'))).toBe(true);
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
