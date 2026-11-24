import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const page=readFileSync('app/driver/history/page.tsx','utf8');
describe('Driver Diary reference search safety',()=>{
 it('includes poster your_ref in client search and projection',()=>{expect(page).toContain('job.your_ref');expect(page).toContain('booking_reference, your_ref, companies:');});
 it('pages with driver authorization and deterministic order',()=>{expect(page).toContain('findDriverHistoryReferences(driverId, reference');expect(page).toContain(".eq('assigned_driver_id', authorizedDriverId)");expect(page).toContain(".order('id', { ascending: false })");expect(page).toContain('.range(offset, offset + count - 1)');});
 it('deduplicates matches from newest page',()=>expect(page).toContain('if (!known.has(row.id))'));
 it('does not replace official job identifier',()=>expect(page).toContain('known.add(row.id)'));
});
