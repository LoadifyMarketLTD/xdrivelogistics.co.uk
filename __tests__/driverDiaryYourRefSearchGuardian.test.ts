import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const page=readFileSync('app/driver/history/page.tsx','utf8');
describe('Driver Diary reference search safety',()=>{
 it('includes poster your_ref in client search and query projection',()=>{expect(page).toContain('job.your_ref');expect(page).toContain('booking_reference, your_ref, companies:');});
 it('queries references beyond initial page with driver authorization before filtering',()=>{const start=page.indexOf('const { data: matchingRows');const end=page.indexOf('if (referenceError)',start);const q=page.slice(start,end);expect(q).toContain(".eq('assigned_driver_id', driverId)");expect(q).toContain(".ilike('your_ref'");});
 it('deduplicates matches from newest page',()=>expect(page).toContain('if (!known.has(row.id))'));
 it('does not replace official job identifier',()=>expect(page).toContain('known.add(row.id)'));
});
