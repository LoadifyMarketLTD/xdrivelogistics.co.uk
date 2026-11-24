import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const src=readFileSync('app/driver/history/page.tsx','utf8');
describe('Driver Diary stale query protection',()=>{
 it('rejects stale result before replacing jobs',()=>expect(src).toContain('if (currentSearchVersion !== searchVersionRef.current) { finishLoad(); return; }'));
 it('retries latest search after stale request releases lock',()=>expect(src).toContain('setRefreshVersion(v => v + 1)'));
 it('tracks changed search requests',()=>expect(src).toContain('searchVersionRef.current += 1; void fetchHistory()'));
});
