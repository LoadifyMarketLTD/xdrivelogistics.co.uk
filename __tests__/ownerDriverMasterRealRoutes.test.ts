import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=(path:string)=>readFileSync(join(root,path),'utf8');

describe('authenticated Owner Driver Master Workspace',()=>{
  const operations=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
  const gate=read('app/driver/DriverMasterLayoutGate.tsx');

  it('routes the approved sidebar to existing production Driver pages instead of demo tab state',()=>{
    expect(operations).toContain('isLiveDriverWorkspace');
    expect(operations).toContain('router.push(DRIVER_LIVE_ROUTES[i]');
    expect(operations).toContain("'/driver/loads'");
    expect(operations).toContain("'/driver/quotes'");
    expect(operations).toContain("'/driver/vehicles'");
    expect(operations).toContain("'/driver/history'");
    for(const section of ['post-load','loads','quotes','jobs','vehicles','drivers','history','finance','network','directory','availability','returns','freight-vision','messages','notifications','won-work','documents','settings']){
      expect(existsSync(join(root,'app/driver',section,'page.tsx'))).toBe(true);
    }
  });

  it('maintains actual Owner Driver role and page-specific nav selection on deep links',()=>{
    expect(gate).toContain("workspace==='owner_driver'?'Owner Driver'");
    expect(gate).toContain('key={pathname}');
    expect(gate).toContain('initialTab={DRIVER_MASTER_TAB_BY_ROUTE[section]??0}');
    expect(gate).toContain('documents:17,settings:18');
  });

  it('provides Documents and Settings in the same Master sidebar',()=>{
    expect(operations).toContain("isLiveDriverWorkspace?['Documents','Settings']");
    expect(operations).toContain("'/driver/documents','/driver/settings'");
  });

  it('does not fetch or display demo loads in signed-in Driver workspaces',()=>{
    expect(operations).toContain('useDemoLoads(isLiveDriverWorkspace)');
    expect(read('app/try-xdrive-demo/components/demoExchange.ts')).toContain('if(ctx||isolated||disabled)return');
    expect(operations).toContain('!live&&!authenticated');
  });

  it('opens all real Driver quotes and personal job history by default',()=>{
    const quotes=read('app/driver/quotes/page.tsx');
    const diary=read('app/driver/history/page.tsx');
    expect(quotes).toContain("useState<TabId>('submitted')");
    expect(quotes).toContain('quoteBucket(bid) !== activeTab');
    expect(quotes).toContain('Awarded');
    expect(diary).toContain("useState<'company' | 'mine'>('mine')");
    expect(diary).toContain("<option value=\"company\">Company Diary");
  });
  it('keeps the owner-driver production dashboard and real vehicle API',()=>{
    expect(read('app/driver/page.tsx')).toContain("role === 'Owner Driver' ? <Company3150LiveProvider>");
    expect(read('app/driver/vehicles/page.tsx')).toContain("fetch('/api/driver/vehicles'");
  });
});
