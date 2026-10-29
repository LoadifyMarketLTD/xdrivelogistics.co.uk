const {chromium}=require('@playwright/test');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9222');
const c=b.contexts()[0];for(const [i,p] of c.pages().entries()){
 const url=p.url();
 let visibility='unknown';try{visibility=await p.evaluate(()=>document.visibilityState)}catch{}
 console.log('OPPO_TAB',i,visibility,new URL(url).pathname);
}process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});