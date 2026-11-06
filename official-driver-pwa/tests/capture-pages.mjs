import fs from 'node:fs'
const out='C:/Users/xdriv/OneDrive/Desktop/XDRIVE-DRIVER-PWA-NEW-LOCAL/screenshots'
fs.mkdirSync(out,{recursive:true})
const pages=await (await fetch('http://127.0.0.1:9333/json/list')).json()
const page=pages.find(p=>p.type==='page'&&p.url.includes('4277'))
if(!page)throw Error('No XDrive tab')
const ws=new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
let seq=0;const pending=new Map()
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}})
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
await send('Page.enable')
const wait=ms=>new Promise(r=>setTimeout(r,ms))
for(const name of ['Loads','Quotes','Bookings','Map','Invoices','More']){
 if(name==='Invoices'){await evaluate("document.querySelector('nav button:last-child')?.click()");await wait(150)}
 const ok=await evaluate(`(()=>{if(['Map','Invoices'].includes('${name}')){document.querySelector('nav button:last-child')?.click();const b=[...document.querySelectorAll('main button')].find(x=>x.textContent.trim()==='${name}');if(b){b.click();return true}return false}const b=[...document.querySelectorAll('nav button')].find(x=>x.textContent.trim().endsWith('${name}'));if(b){b.click();return true}return false})()`)
 await wait(350)
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
 fs.writeFileSync(out+'/'+name.toLowerCase()+'.png',Buffer.from(shot.data,'base64'))
 const details=await evaluate("({title:document.querySelector('h1')?.textContent,body:document.querySelector('main')?.innerText?.slice(0,450),width:document.documentElement.scrollWidth})")
 console.log(name,ok,JSON.stringify(details))
}
ws.close()
