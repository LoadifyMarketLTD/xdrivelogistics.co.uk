import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const root='app/driver-pwa-fresh/visual-preview/workflow';

describe('driver booking storyboard navigation chain 0-11',()=>{
  it('links every forward booking step to the next page',()=>{
    const page0=readFileSync(root+'/page-0/page.tsx','utf8');
    expect(page0).toContain("router.push('/driver-pwa-fresh/visual-preview/workflow/page-1')");
    for(const page of [1,2,3,4,5,6,7,8,10]){
      const source=readFileSync(root+'/page-'+page+'/page.tsx','utf8');
      expect(source, 'page-'+page+' must link to page-'+(page+1))
        .toContain("/driver-pwa-fresh/visual-preview/workflow/page-"+(page+1));
    }
  });

  it('keeps invoice preview separate from simulated invoice-issued confirmation',()=>{
    const page9=readFileSync(root+'/page-9/page.tsx','utf8');
    expect(page9).not.toContain('/driver-pwa-fresh/visual-preview/workflow/page-10');
    expect(page9).toContain('/driver/finance/invoices/');
    expect(page9).toContain('Nothing has been emailed.');
  });

  it('records acceptance before entering page 1',()=>{
    const page0=readFileSync(root+'/page-0/page.tsx','utf8');
    expect(page0).toContain("updateDemo('visual-1'");
    expect(page0).toContain("stage:'received'");
  });

  it('keeps page 11 as the terminal payment-tracking screen',()=>{
    const page11=readFileSync(root+'/page-11/page.tsx','utf8');
    expect(page11).toContain('InvoicePaymentTrackingStep');
    expect(page11).not.toContain('/workflow/page-12');
  });
});
