import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Onboarding recovery workflow', () => {
  it('derives missing fields and documents from the canonical onboarding contract', () => {
    const route = readRepoFile('app/api/super-admin/onboarding/[id]/request-completion/route.ts');
    expect(route).toContain('assessOnboardingRecovery');
    expect(route).toContain(".from('driver_identity_documents')");
    expect(route).toContain(".from('company_documents')");
    expect(route).toContain("'onboarding_completion_required'");
    expect(route).toContain("'onboarding_completion_reminder'");
    expect(route).toContain("onboarding_url: '/onboarding/resume'");
  });

  it('fails closed in Deploy Preview and rate-limits reminders to seven days', () => {
    const route = readRepoFile('app/api/super-admin/onboarding/[id]/request-completion/route.ts');
    expect(route).toContain('Deploy Preview is read-only');
    expect(route).toContain('7 * 24 * 60 * 60 * 1000');
    expect(route).toContain('A reminder can be sent only after 7 days.');
  });

  it('exposes a Platform Owner recovery queue without mutating applicant progress', () => {
    const api = readRepoFile('app/api/super-admin/onboarding/recovery/route.ts');
    const queue = readRepoFile('app/super-admin/compliance/documents/OnboardingRecoveryQueue.tsx');
    const page = readRepoFile('app/super-admin/compliance/documents/page.tsx');
    expect(api).toContain(".in('status', ['invited', 'draft', 'in_progress', 'request_changes'])");
    expect(api).toContain('canonical_completion_percentage');
    expect(queue).toContain('Onboarding recovery queue');
    expect(queue).toContain('Send completion request');
    expect(page).toContain('<OnboardingRecoveryQueue />');
  });

  it('delivers completion requests through the canonical notification worker', () => {
    const worker = readRepoFile('supabase/functions/notify-operational-event/index.ts');
    expect(worker).toContain('handleOnboardingCompletionRequired');
    expect(worker).toContain("case 'onboarding_completion_required'");
    expect(worker).toContain("case 'onboarding_completion_reminder'");
    expect(worker).toContain('event.payload.missing_fields');
    expect(worker).toContain('event.payload.missing_documents');
    expect(worker).toContain('Resume onboarding');
    expect(worker).toContain('You do not need to start again');
  });
});
