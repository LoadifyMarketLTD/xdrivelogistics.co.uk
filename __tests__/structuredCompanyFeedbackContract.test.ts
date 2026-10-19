import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const api = readFileSync(resolve(process.cwd(), 'app/api/admin/jobs/[id]/feedback/route.ts'), 'utf8');
const dialog = readFileSync(resolve(process.cwd(), 'app/components/workspace/CompanyFeedbackDialog.tsx'), 'utf8');
const broker = readFileSync(resolve(process.cwd(), 'app/broker/diary/page.tsx'), 'utf8');
const profile = readFileSync(resolve(process.cwd(), 'app/api/member-profile/[companyId]/route.ts'), 'utf8');

describe('structured company feedback contract', () => {
  it('persists structured reputation signals alongside rating and comment', () => {
    expect(api).toContain('would_use_again: optionalBoolean(body.wouldUseAgain)');
    expect(api).toContain('delivered_promptly: optionalBoolean(body.deliveredPromptly)');
    expect(api).toContain('courteous: optionalBoolean(body.courteous)');
    expect(api).toContain('would_use_again, delivered_promptly, courteous');
  });

  it('collects the three operational feedback signals in shared and broker dialogs', () => {
    for (const source of [dialog, broker]) {
      expect(source).toContain('Would use again');
      expect(source).toContain('Delivered promptly');
      expect(source).toContain('Courteous / professional');
    }
    expect(dialog).toContain('wouldUseAgain');
    expect(dialog).toContain('deliveredPromptly');
    expect(dialog).toContain('courteous');
  });

  it('surfaces structured reputation percentages in member profiles', () => {
    expect(profile).toContain("percentage('would_use_again')");
    expect(profile).toContain("percentage('delivered_promptly')");
    expect(profile).toContain("percentage('courteous')");
    expect(profile).toContain('wouldUseAgainPercent');
    expect(profile).toContain('deliveredPromptlyPercent');
    expect(profile).toContain('courteousPercent');
  });
});
