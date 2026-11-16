import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const file=name=>readFileSync(new URL('../'+name,import.meta.url));
test('PWA installation uses real XD PNG 192 and 512 assets at scoped URLs',()=>{
 const manifest=JSON.parse(file('public/manifest.webmanifest'));
 const html=String(file('index.html'));
 assert.equal(manifest.id,'/driver/reserve-pwa/');
 assert.equal(manifest.scope,manifest.id);
 assert.equal(manifest.display,'standalone');
 for(const n of [192,512]){
  const url='/driver/reserve-pwa/icons/icon-'+n+'x'+n+'.png';
  assert.ok(manifest.icons.some(icon=>icon.src===url&&icon.sizes===n+'x'+n));
  const data=file('public/icons/icon-'+n+'x'+n+'.png');
  assert.equal(data.subarray(1,4).toString(),'PNG');
  assert.equal(data.readUInt32BE(16),n);
  assert.equal(data.readUInt32BE(20),n);
 }
 assert.match(html,/rel="apple-touch-icon"/);
});
test('offline worker serves public app shell but never caches or intercepts private API',async()=>{
 const callbacks=new Map(),stored=new Map();let offline=false;
 const key=x=>typeof x==='string'?x:new URL(x.url).pathname;
 const cache={put:async(x,r)=>{stored.set(key(x),r.clone())},match:async x=>stored.get(key(x))?.clone()};
 const caches={open:async()=>cache,keys:async()=>[],delete:async()=>true};
 const html='<html><script type="module" src="/driver/reserve-pwa/assets/testhash.js"></script><link rel="stylesheet" href="/driver/reserve-pwa/assets/testhash.css"/></html>';
 const fetch=async x=>{
  if(offline)throw Error('offline');
  return new Response(key(x).endsWith('index.html')?html:'public',{status:200});
 };
 const self={location:{origin:'https://test.local'},clients:{claim:async()=>{}},
  skipWaiting(){},addEventListener(n,fn){callbacks.set(n,fn)}};
 runInNewContext(String(file('public/sw.js')),{self,caches,fetch,URL,Response,Set,Promise,console},{timeout:2000});
 const ins={waitUntil(p){this.promise=p}};
 callbacks.get('install')(ins);await ins.promise;
 for(const item of ['/driver/reserve-pwa/index.html','/driver/reserve-pwa/assets/testhash.js','/driver/reserve-pwa/icons/icon-192x192.png']){
  assert.ok(stored.has(item),'Missing public shell cache: '+item);
 }
 offline=true;
 for(const url of ['https://test.local/driver/reserve-pwa/','https://test.local/driver/reserve-pwa/assets/testhash.js']){
  const e={request:new Request(url),respondWith(p){this.promise=p}};
  callbacks.get('fetch')(e);
  assert.equal((await e.promise).status,200);
 }
 for(const url of ['https://test.local/api/driver/mobile/jobs','https://test.local/driver/reserve-pwa/api/private','https://test.local/driver/reserve-pwa/jobs/123']){
  const e={request:new Request(url),respondWith(){assert.fail('Intercepted private data')}};
  callbacks.get('fetch')(e);
 }
 const e={request:new Request('https://test.local/driver/reserve-pwa/index.html',{method:'POST'}),respondWith(){assert.fail('Intercepted POST')}};
 callbacks.get('fetch')(e);
});