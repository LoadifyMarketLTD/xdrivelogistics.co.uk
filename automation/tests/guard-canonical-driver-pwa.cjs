#!/usr/bin/env node
'use strict';
/* Read-only guard for the approved Driver PWA UI boundary. Legacy routes elsewhere
 * are intentionally NOT deleted: some are needed for booking visual review or
 * other workspaces. Only the canonical UI entrypoint and its local dependencies
 * are guarded against importing/redirecting to retired Driver PWA shells. */
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const canonical=path.join(root,'app/driver-pwa-fresh');
const forbidden=[/['"`]\/m\/driver-v2(?:\/|['"`?])/i,/['"`]\/driver-pwa-sandbox(?:\/|['"`?])/i,/['"`]\/driver-pwa-v2(?:\/|['"`?])/i,/['"`]\/driver-pwa-canonical(?:\/|['"`?])/i,/(?:from\s*|import\s*\(|require\s*\()\s*['"`][^'"`]*(?:\/m\/_components\/|\/driver-pwa-sandbox\/|\/driver-pwa-v2\/)/i];
const exceptions=new Set(['visual-preview/booking-11/page.tsx']);
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:tsx?|jsx?)$/.test(e.name))files.push(p)}}walk(canonical);
const violations=[];for(const f of files){const relative=path.relative(canonical,f).replace(/\\/g,'/');if(exceptions.has(relative))continue;const content=fs.readFileSync(f,'utf8');for(const rule of forbidden)if(rule.test(content))violations.push(`${relative}: ${rule}`)}
for(const route of ['page.tsx','jobs/page.tsx','quotes/page.tsx','bookings/page.tsx'])if(!fs.existsSync(path.join(canonical,route)))violations.push(`missing canonical route: ${route}`);
const home=fs.readFileSync(path.join(canonical,'page.tsx'),'utf8');if(!/redirect\(['"]\/driver-pwa-fresh\/jobs['"]\)/.test(home))violations.push('canonical home no longer redirects to /driver-pwa-fresh/jobs');
if(violations.length){console.error('CANONICAL DRIVER PWA GUARD FAIL\n'+violations.join('\n'));process.exit(1)}
console.log(`CANONICAL DRIVER PWA GUARD PASS (${files.length} UI files checked; isolated booking visual-preview exception documented)`);
