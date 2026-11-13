const fs=require('node:fs');
const postcss=require('postcss');
const diary=fs.readFileSync('app/driver/history/page.tsx','utf8');
const jobs=fs.readFileSync('app/driver/jobs/page.tsx','utf8');
const css=postcss.parse(fs.readFileSync('app/driver/xdrive-operational-cards-v2.css','utf8'));
const check={
  'Diary initial view is own assigned jobs':diary.includes("useState<'company' | 'mine'>('mine')"),
  'Company Diary only for authorised owner':diary.includes('canViewCompanyDiary && <option value="company">'),
  'Bookings preserve route, timings and execution': ['xd-booking-card__route','xd-booking-card__times','xd-booking-card__state'].every(v=>jobs.includes(v)),
  'POD, Order, Notes, History, Documents, Invoice exist':['pod','order','notes','history','documents','invoice'].every(v=>diary.includes("id: '"+v+"'")),
  'Bookings execution links preserved':jobs.includes('/driver/jobs/${job.id}'),
  'New CSS structurally valid':css.nodes.length>10
};
for(const [label,ok] of Object.entries(check))console.log((ok?'PASS':'FAIL')+' '+label);
if(Object.values(check).some(v=>!v))process.exitCode=1;
