import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read=(f:string)=>fs.readFileSync(path.join(process.cwd(),f),'utf8');

describe('driver loads expand contract',()=>{
  const page=read('app/driver/loads/page.tsx');
  const css=read('app/driver/driver-full-prototype.css');
  it('applies the expanded class that the CSS contract requires',()=>{
    expect(page).toContain("className={`load-card cx-load-card${expanded ? ' expanded' : ''}`}");
    expect(css).toContain('.load-card.expanded .load-extra');
    expect(page).toContain('aria-expanded={expanded}');
  });
});

describe('workspace session stability and cross-surface sync',()=>{
  const protectedRoute=read('app/components/ProtectedRoute.tsx');
  const auth=read('app/components/AuthContext.tsx');
  const dataHook=read('app/components/workspace/useCompanyWorkspaceData.ts');
  const loads=read('app/customer/CustomerOperationalPages.tsx');
  const quotes=read('app/customer/quotes/CustomerQuotesCxPage.tsx');
  const diary=read('app/customer/diary/page.tsx');
  it('does not redirect a recoverable Supabase session to login while workspace identity is recovering',()=>{
    expect(protectedRoute).toContain('hasSupabaseSession');
    expect(protectedRoute).toContain('refreshUserContext');
    expect(protectedRoute).toContain('!user && hasSupabaseSession');
    expect(protectedRoute).toContain('!user && !hasSupabaseSession');
    expect(auth).toContain('explicitSignOutRef');
    expect(auth).toContain('AuthContext null-session verification failed');
  });
  it('does not proactively rotate or re-resolve auth from every workspace data query',()=>{
    const start=dataHook.indexOf('const sessionResult = await supabase.auth.getSession()');
    const end=dataHook.indexOf('if (!driverSurface && !companyId)',start);
    const block=dataHook.slice(start,end);
    expect(block).not.toContain('expiresSoon');
    expect(block).not.toContain('supabase.auth.refreshSession()');
    expect(block).not.toContain('refreshUserContext');
  });
  it('keeps loads, quotes and diary on the same canonical job_bids dataset and refreshes visible workspaces',()=>{
    expect(dataHook).toContain(".from('job_bids')");
    expect(dataHook).toContain('useVisibleRefresh(refresh, {');
    expect(dataHook).toContain('intervalMs: 10_000');
    expect(dataHook).toContain('minGapMs: 2_500');
    expect(loads).toContain('useCompanyWorkspaceData()');
    expect(quotes).toContain('useCompanyWorkspaceData()');
    expect(diary).toContain('useCompanyWorkspaceData()');
    expect(diary).toContain("if (bid.status === 'submitted') row.submitted += 1");
  });
});
