import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
function pages(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?pages(path.join(dir,f.name)):f.isFile()&&f.name==='page.tsx'?[path.join(dir,f.name)]:[]);
}
const routes=pages(path.join(root,'app','admin')).map(f=>'/'+path.relative(path.join(root,'app'),path.dirname(f)).split(path.sep).join('/').replace(/\[[^\]]+\]/g,'00000000-0000-4000-8000-000000000000'));
let checked=0;const failures=[];
async function probe(route){
 try{
  const r=await fetch('http://127.0.0.1:3192'+route,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  const target=r.headers.get('location')||'';
  if((r.status===307||r.status===302||r.status===308)&&(/\/login\?/).test(target))checked++;
  else failures.push({route,status:r.status,target});
 }catch(e){failures.push({route,error:String(e).slice(0,90)})}
}
await Promise.all(Array.from({length:12},async()=>{while(routes.length){const route=routes.shift();await probe(route)}}));
console.log(JSON.stringify({checked,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
