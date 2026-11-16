import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
test('Production PWA HTML references the compiled POD session-recovery bundle',()=>{
  const html=readFileSync(resolve(root,'public/driver/reserve-pwa/index.html'),'utf8');
  const found=html.match(/\/driver\/reserve-pwa\/assets\/(index-[a-zA-Z0-9_-]+\.js)/);
  assert.ok(found, 'missing hashed PWA runtime script');
  const asset=resolve(root,'public/driver/reserve-pwa/assets',found[1]);
  assert.ok(existsSync(asset), 'HTML points at an uncommitted bundle');
  const code=readFileSync(asset,'utf8');
  assert.ok(code.includes('Your stored evidence is preserved'),'shipped bundle lacks 401 recovery UI');
  assert.ok(code.includes('Delivery Time *'),'shipped bundle lacks recovered time review field');
  assert.ok(code.includes('Could not restore the saved POD draft'),'shipped bundle lacks re-authenticated draft error');
});
