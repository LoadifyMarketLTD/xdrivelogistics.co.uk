import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');
const legalState = read('lib/legal/legalAgreementState.ts');
const legalApi = read('app/api/account/legal-agreements/route.ts');

describe('legal acceptance readiness regression', () => {
  it('does not make acknowledgement wording a retroactive re-acceptance trigger', () => {
    expect(legalState).not.toContain("reasons.push('acceptance_statement_changed')");
    expect(legalState).toContain("if (acceptance.legalVersion !== requirement.legalVersion)");
    expect(legalState).toContain("if (acceptance.privacyDocumentHash !== requirement.privacyDocumentHash)");
  });

  it('does not invalidate a current signature merely because the viewer opens another translation', () => {
    expect(legalApi).toContain("const signedLanguage = snapshot.acceptanceLanguage ?? 'en';");
    expect(legalApi).toContain('const signedRequirement = buildCurrentLegalRequirement(registrationRole, signedLanguage);');
    expect(legalApi).toContain('!evaluateLegalAcceptance(signedRequirement, snapshot).requiresReacceptance');
    expect(legalApi).not.toContain('findCurrentLegalAcceptanceIndex(requirement, snapshots)');
  });
});
