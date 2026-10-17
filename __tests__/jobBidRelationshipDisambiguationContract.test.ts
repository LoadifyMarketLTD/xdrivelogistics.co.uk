import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const lifecycle = read('app/api/workspace/bids/[id]/lifecycle/route.ts');
const award = read('app/api/admin/bids/[id]/accept/route.ts');
const identities = read('app/api/admin/bids/identities/route.ts');

describe('job_bids → jobs relationship disambiguation', () => {
  it('pins quote lifecycle to job_bids.job_id instead of the accepted_bid reverse FK', () => {
    expect(lifecycle).toContain('jobs!job_bids_job_id_fkey(company_id)');
    expect(lifecycle).not.toContain('jobs!inner(company_id)');
  });

  it('pins award lookup to the quote job_id relationship', () => {
    expect(award).toContain('jobs!job_bids_job_id_fkey(company_id)');
    expect(award).not.toContain('jobs!inner(company_id)');
  });

  it('pins admin bidder identity lookup to the quote job_id relationship', () => {
    expect(identities).toContain('jobs!job_bids_job_id_fkey(company_id)');
    expect(identities).not.toContain('jobs!inner(company_id)');
  });
});
