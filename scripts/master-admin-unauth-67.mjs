import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
function pages(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>
 f.isDirectory()?pages(path.join(dir,f.name)) : f.isFile()&&f.name==='page.tsx'?[path.join(dir,f.name)]:[]);
}
const source=pages(path.join(root,'app','admin'));
const urls=source.map(f=>'/'+path.relative(path.join(root,'app'),path.dirname(f)).split(path.sep).join('/').replace(/\[[^\]]+\]/g,'00000000-0000-4000-8000-000000000000'));
const browser=await chromium.launch({headless:true});
const failures=[];
let checked=0;
try {
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const workers=Array.from({length:4},async()=>{
  while(urls.length){
   const route=urls.shift();
   const page=await context.newPage();
   try {
    await page.goto('http://127.0.0.1:3192'+route,{waitUntil:'domcontentloaded',timeout:35000});
    const landed=new URL(page.url());
    if(landed.pathname!=='/login'&&landed.pathname!=='/forbidden')failures.push({route,landed:landed.pathname,status:await page.title()});
    else checked++;
   }catch(error){failures.push({route,error:String(error).slice(0,160)})}
   await page.close();
  }
 });
 await Promise.all(workers);
 console.log(JSON.stringify({total:source.length,checked,failures},null,2));
 if(failures.length)process.exitCode=1;
}finally{await browser.close()}
