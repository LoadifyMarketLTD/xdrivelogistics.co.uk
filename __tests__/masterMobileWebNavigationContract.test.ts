import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path:string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Master web workspace mobile navigation independent of Driver PWA',()=>{
  const master=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
  const sidebar=read('app/try-xdrive-demo/components/ApprovedSidebar.tsx');
  const css=read('app/try-xdrive-demo/components/mobile-master-navigation.css');
  it('provides a mobile menu button and a screen-reader labelled Master navigation',()=>{
    expect(master).toContain('xd-mobile-nav-toggle');
    expect(master).toContain('aria-expanded={mobileMenuOpen}');
    expect(master).toContain('aria-controls="xdrive-master-mobile-navigation"');
    expect(sidebar).toContain('id="xdrive-master-mobile-navigation"');
    expect(sidebar).toContain('aria-label="Master workspace sections"');
  });
  it('opens, closes on nav, backdrop, Escape and route changes',()=>{
    expect(master).toContain('mobileOpen={mobileMenuOpen}');
    expect(master).toContain('onMobileClose={()=>setMobileMenuOpen(false)}');
    expect(master).toContain('setMobileMenuOpen(false);},[initialTab]');
    expect(master).toContain("event.key==='Escape'");
    expect(master).toContain('xd-mobile-sidebar-backdrop');
    expect(sidebar).toContain('onMobileClose?.();');
    expect(sidebar).toContain('Close workspace menu');
  });
  it('overrides old hidden sidebar only on mobile and leaves desktop 3150 unchanged',()=>{
    expect(master).toContain('mobile-master-navigation.css');
    expect(css).toContain('@media (max-width:850px)');
    expect(css).toContain('> .xd-approved-sidebar.is-mobile-open');
    expect(css).toContain('visibility: visible !important');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('width: min(84vw, 298px)');
    expect(css).not.toContain('app/driver-pwa-fresh');
    expect(read('app/try-xdrive-demo/components/approved-sidebar-3119.css')).toContain('@media(min-width:851px)');
  });
});
