import { describe, expect, it } from 'vitest';
import { marketplacePage } from '../app/driver/_components/marketplacePagination';
import { readFileSync } from 'node:fs';
describe('Owner marketplace pagination', () => {
  it('shows exactly 25 records on the first page', () => expect(marketplacePage(61,25,1)).toEqual({page:1,pageCount:3,start:0,end:25,hasPrevious:false,hasNext:true}));
  it('moves forward without duplicating prior results', () => expect(marketplacePage(61,25,2)).toEqual({page:2,pageCount:3,start:25,end:50,hasPrevious:true,hasNext:true}));
  it('supports incomplete last page', () => expect(marketplacePage(61,25,3)).toEqual({page:3,pageCount:3,start:50,end:61,hasPrevious:true,hasNext:false}));
  it('clamps page when live results shrink', () => expect(marketplacePage(12,25,3).page).toBe(1));
  it('handles no results', () => expect(marketplacePage(0,25,4)).toEqual({page:1,pageCount:1,start:0,end:0,hasPrevious:false,hasNext:false}));
  it('supports all allowed page sizes', () => { for(const size of [10,25,50]) expect(marketplacePage(101,size,2).end-marketplacePage(101,size,2).start).toBe(size); });
  it('covers every result once', () => { const rows=Array.from({length:61},(_,i)=>i); const pages=[1,2,3].flatMap(n=>{const p=marketplacePage(rows.length,25,n);return rows.slice(p.start,p.end)});expect(pages).toEqual(rows); });
  it('wires page bounds and navigation to the list without restricting radar data', () => { const src=readFileSync(new URL('../app/driver/loads/page.tsx',import.meta.url),'utf8');expect(src).toContain('filteredLoads.slice(pagination.start, pagination.end)');expect(src).toContain('filteredLoads.map((load)');for(const label of ['First page','Previous page','Next page','Last page'])expect(src).toContain('aria-label="'+label+'"');expect(src).toContain('setPage(1)');expect(src).not.toContain('setVisibleCount'); });
});
