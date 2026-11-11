import fs from 'node:fs'
const p='tests/browser-flow.mjs'
let s=fs.readFileSync(p,'utf8')
const old="if(status==='POD_SUBMITTED'){assert(disabled===true,'POD gated without evidence');break}"
const next=`if(status==='POD_SUBMITTED'){
  assert(disabled===true,'POD gated without evidence')
  assert(await evalJs("(()=>{const i=document.querySelector('input[placeholder=\\\"Recipient name\\\"]');if(!i)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(i,'Test Receiver');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()"),'Recipient entered')
  await wait()
  const doc=await send('DOM.getDocument')
  const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'})
  assert(Boolean(input.nodeId),'POD file input exists')
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['C:/Users/xdriv/OneDrive/Desktop/XDRIVE-DRIVER-PWA-NEW-LOCAL/tests/pod-test.png']})
  await wait()
  assert(await click('Save POD photo locally'),'Save POD photo')
  await new Promise(r=>setTimeout(r,500))
  const saved=await evalJs("new Promise((resolve,reject)=>{const r=indexedDB.open('xdrive-local-pod-v1');r.onsuccess=()=>{const t=r.result.transaction('evidence','readonly');const g=t.objectStore('evidence').get('TEST-1001');g.onsuccess=()=>resolve({recipient:g.result?.recipient,bytes:g.result?.photo?.size});g.onerror=()=>reject(g.error)};r.onerror=()=>reject(r.error)})")
  assert(saved.recipient==='Test Receiver' && saved.bytes>0,'POD photo persisted in IndexedDB')
  const enabled=await evalJs("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Confirm: POD SUBMITTED'));return b?!b.disabled:false})()")
  assert(enabled,'POD transition unlocked after photo saved')
  assert(await click('Confirm: POD SUBMITTED'),'POD submitted locally')
  await wait()
  continue
}`
if(!s.includes(old))throw Error('POD test marker missing')
s=s.replace(old,next)
const old2="const shot=await send('Page.captureScreenshot'"
const add=`assert(await evalJs("document.body.innerText.includes('POD SUBMITTED')"),'POD submitted status shown')
assert(await click('Confirm: DELIVERED'),'Mark test delivery completed')
await wait()
assert(await evalJs("document.body.innerText.includes('Delivery completed')"),'Delivered confirmation')
assert(await click('More'),'More menu for invoices')
await wait()
assert(await click('Invoices'),'Open invoice screen')
await wait()
assert(await evalJs("document.body.innerText.includes('TEST-1001')"),'Delivered job invoice eligible')
`
if(!s.includes(old2))throw Error('Screenshot marker missing')
s=s.replace(old2,add+old2)
fs.writeFileSync(p,s,'utf8')
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z5kAAAAASUVORK5CYII=','base64')
fs.writeFileSync('tests/pod-test.png',png)
console.log('Extended browser flow with POD IndexedDB and invoice eligibility')
