import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path:string) => readFileSync(join(process.cwd(),path),'utf8');
const base='app/driver/';
const pages=[
 ['loads/page.tsx','ApprovedDriverLoadCard'],
 ['quotes/page.tsx','ApprovedDriverQuoteCard'],
 ['jobs/page.tsx','CxDiaryCard'],
 ['history/page.tsx','ApprovedDriverDiaryCard'],
] as const;

describe('approved Driver Master identity with real operational data',()=>{
 it.each(pages)('uses approved card family in %s', (path,component)=>{
  expect(read(base+path)).toContain(component);
  expect(read(base+path)).toContain('<ProtectedRoute');
 });
 it('uses shared approved 3118 card geometry, not demo transactions',()=>{
  const card=read(base+'_components/ApprovedDriverOperationalCard.tsx');
  expect(card).toContain('<Master3150Card');
  expect(card).toContain('className={`xd-approved-live-card ${className}`}');
  expect(card).toContain('terms={paymentTerms ??');
  expect(card).toContain('{footer}');
  expect(read(base+'layout.tsx')).toContain('driver-approved-boards.css');
 });
 it('preserves live quote submission, real booking execution and real diary status data',()=>{
  expect(read(base+'loads/page.tsx')).toContain('MarketplaceQuoteModal');
  expect(read(base+'quotes/page.tsx')).toContain("from('job_bids')");
  expect(read(base+'jobs/page.tsx')).toContain("from('jobs')");
  const diary=read(base+'history/page.tsx');
  expect(diary).toContain('getCanonicalDiaryTabs');
  expect(diary).toContain('Real booking statistics');
  expect(diary).toContain('historyFilters.map');
  expect(diary).toContain('fetchHistory');
 });
});
