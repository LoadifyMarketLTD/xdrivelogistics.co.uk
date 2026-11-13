const fs=require('fs');
const files=['CxLoadCard.tsx','CxQuoteCard.tsx','CxDiaryCard.tsx'];
let good=true;
for(const f of files){
 const s=fs.readFileSync('app/components/workspace/'+f,'utf8');
 const checks=[s.includes('<XDriveTransportOverview'),s.includes('showXDriveContext ?'),s.includes(') : ('),s.includes('xdrive-cx-')];
 const pass=checks.every(Boolean);
 console.log((pass?'PASS':'FAIL')+' v3 markup and legacy fallback: '+f);
 good=good&&pass;
}
const q=fs.readFileSync('app/driver/quotes/page.tsx','utf8');
const f=q.includes('View quote record')&&q.includes('next.add(bid.id)');
console.log((f?'PASS':'FAIL')+' restricted quote opens own bid details');
good=good&&f;
const ui=fs.readFileSync('app/components/workspace/XDriveTransportOverview.tsx','utf8');
const structure=['xd3-route-line__track','xd3-schedule-row','xd3-journey__context'].every(x=>ui.includes(x));
console.log((structure?'PASS':'FAIL')+' distinct journey / schedule / context anatomy');
good=good&&structure;
if(!good)process.exit(1);
