const origin=process.env.XDRIVE_AUDIT_URL || 'https://www.xdrivelogistics.co.uk/driver/official-pwa/';
const pages=await(await fetch('http://127.0.0.1:9334/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.includes('127.0.0.1'));
if(!page)throw Error('Edge debugging tab unavailable');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
let id=0;const pending=new Map();
ws.addEventListener('message',event=>{const message=JSON.parse(event.data);const wait=pending.get(message.id);if(wait){pending.delete(message.id);message.error?wait.reject(Error(message.error.message)):wait.resolve(message.result)}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}))});
const evaluate=async expression=>{const result=(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result;if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.value};
const check=(value,message)=>{if(!value)throw Error('FAIL '+message);console.log('PASS '+message)};
const pause=()=>new Promise(r=>setTimeout(r,350));
try{
 await send('Page.navigate',{url:origin});await new Promise(r=>setTimeout(r,1100));
 check(await evaluate("document.title.includes('XDrive Driver PWA')"),'Original driver PWA loads in Edge');
 check(await evaluate("document.body.innerText.includes('Sign in to XDrive Logistics')"),'Unauthenticated driver sign-in visible');
 check(await evaluate("['Loads','Quotes','Bookings'].every(t=>[...document.querySelectorAll('nav button')].some(b=>b.innerText.includes(t)))"),'Approved three-tab navigation visible');
 check(await evaluate("(()=>{const b=document.querySelector('button[aria-label=\"Open driver menu\"]');if(!b)return false;b.click();return true})()"),'Driver menu opens');await pause();
 check(await evaluate("document.body.innerText.includes('Load Alerts') && document.body.innerText.includes('Notifications')"),'Menu sections rendered');
 check(await evaluate("document.body.innerText.includes('Sign in to XDrive Logistics')"),'Menu does not bypass authentication');
 console.log('PASS Browser smoke complete; authenticated API/POD/invoice issuance not exercised');
}finally{ws.close()}
