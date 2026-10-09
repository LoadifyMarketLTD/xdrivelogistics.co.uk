import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('cross-workspace canonical Diary wiring', () => {
  const customer = read('app/customer/diary/page.tsx');
  const operations = read('app/components/workspace/OperationsDiaryPage.tsx');
  const driver = read('app/driver/history/page.tsx');

  it('Customer uses the canonical Diary engine instead of a private status table', () => {
    expect(customer).toContain("getCanonicalDiaryTabs('customer')");
    expect(customer).toContain('matchesCanonicalDiaryBucket');
    expect(customer).toContain("from('reviews')");
    expect(customer).toContain("getCanonicalDiaryTabs('customer')");
  });

  it('Carrier, Fleet Manager and Dispatcher derive their tabs from role-specific canonical profiles', () => {
    expect(operations).toContain("user?.membershipRole === 'fleet_manager'");
    expect(operations).toContain("user?.membershipRole === 'dispatcher'");
    expect(operations).toContain('getCanonicalDiaryTabs(diaryRole)');
    expect(operations).toContain('matchesCanonicalDiaryBucket');
  });

  it('Owner Driver and employed Driver use different canonical Diary profiles', () => {
    expect(driver).toContain("getCanonicalDiaryTabs(canViewCompanyDiary ? 'owner_driver' : 'driver')");
    expect(driver).toContain('matchesCanonicalDiaryBucket');
    expect(driver).not.toContain("type FeedbackMode = 'all' | 'awaiting' | 'recent'");
  });
});
