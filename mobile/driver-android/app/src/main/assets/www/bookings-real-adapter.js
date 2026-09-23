(function(){
 'use strict';
 const data=((window.XDRIVE_REAL&&window.XDRIVE_REAL.bookings)||[]).filter(j=>j.isTest!==true);
 const screen=document.querySelector('.screen'),tabs=document.querySelector('.booking-status-tabs');
 if(!screen||!tabs)return;
 const CITY={BB:'BLACKBURN',DA:'ERITH',LS:'LEEDS',NG:'NOTTINGHAM',PR:'PRESTON',M:'MANCHESTER',CH:'CHESTER',CV:'COVENTRY',WN:'WIGAN',SK:'STOCKPORT'};
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const compact=v=>{const p=String(v||'').toUpperCase().replace(/\s+/g,'');return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(p)?p.slice(0,-3)+' '+p.slice(-3):p};
 const outward=v=>{const p=compact(v).replace(/\s+/g,'');return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(p)?p.slice(0,-3):p};
 const place=v=>{const o=outward(v),m=o.match(/^[A-Z]+/),city=CITY[m?m[0]:'']||o;return city===o?o:(city+', '+o)};
 const ukDateKey=v=>{const d=v instanceof Date?v:new Date(v);if(Number.isNaN(d.getTime()))return'';const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
 const when=(a,b)=>{if(!a&&!b)return'Time not supplied';const s=new Date(a||b),e=new Date(b||a),opt={timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false},d=s.toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short'}),t1=s.toLocaleTimeString('en-GB',opt),t2=e.toLocaleTimeString('en-GB',opt);return(t1===t2?t1:t1+' - '+t2)+' | '+d};
 const effectiveStatus=j=>String(j.currentStatus||j.status||j.lifecycleStatus||'').toLowerCase();
 const terminal=new Set(['delivered','completed','cancelled','void','disputed']);
 const inProgress=new Set(['on_my_way','on_my_way_pickup','on_site_pickup','arrived_pickup','loaded','collected','in_transit','on_my_way_delivery','on_my_way_to_delivery','on_site_delivery','arrived_delivery']);
 function bucket(j){
  const s=effectiveStatus(j);
  if(terminal.has(s))return'completed';
  if(inProgress.has(s))return'active';
  const start=Date.parse(j.collectionStart||'');
  return Number.isFinite(start)&&start>Date.now()?'upcoming':'active';
 }
 function badge(j){
  const s=effectiveStatus(j),m={awarded:'AWARDED',allocated:'ALLOCATED',assigned:'ALLOCATED',accepted:'DRIVER ACCEPTED',on_my_way:'ON MY WAY TO COLLECTION',on_my_way_pickup:'ON MY WAY TO COLLECTION',on_site_pickup:'ON SITE - COLLECTION',arrived_pickup:'ON SITE - COLLECTION',loaded:'LOADED',collected:'LOADED',in_transit:'ON MY WAY TO DELIVERY',on_my_way_delivery:'ON MY WAY TO DELIVERY',on_my_way_to_delivery:'ON MY WAY TO DELIVERY',on_site_delivery:'ON SITE - DELIVERY',arrived_delivery:'ON SITE - DELIVERY',delivered:'COMPLETED',completed:'COMPLETED',cancelled:'CANCELLED',void:'CANCELLED',disputed:'DISPUTED'};
  return m[s]||s.replace(/_/g,' ').toUpperCase();
 }
 function completionKey(j){
  const hist=[...(j.statusHistory||[])].reverse();
  const row=hist.find(h=>['delivered','completed'].includes(String(h.status||h.label||'').toLowerCase()));
  return ukDateKey((row&& (row.timestamp||row.createdAt||row.created_at))||j.updatedAt||j.deliveryStart||j.collectionStart||0);
 }
 function sortValue(j){
  const b=bucket(j);
  if(b==='completed')return -(Date.parse(j.updatedAt||j.deliveryStart||j.collectionStart||0)||0);
  return Date.parse(j.collectionStart||j.deliveryStart||0)||0;
 }
 function card(j){
  const st=effectiveStatus(j),b=bucket(j),pod=j.podCompleted===true;
  const ymd=b==='completed'?completionKey(j):ukDateKey(j.collectionStart||j.deliveryStart||j.updatedAt||0);
  const cargo=(j.pallets?j.pallets+' pallet'+(Number(j.pallets)===1?'':'s'):'Cargo details')+(j.weight?' | '+j.weight+' kg':'');
  const target='booking-detail.html?job='+encodeURIComponent(j.id)+'&from=bookings';
  return '<article class="load-card job-card booking-card clickable-card" data-bucket="'+b+'" data-status="'+esc(st)+'" data-date="'+ymd+'" onclick="location.href=\''+target+'\'">'+
   '<div class="company">'+esc(j.company)+(j.companyXdId?'<span class="company-xd-id">('+esc(j.companyXdId)+')</span>':'')+'</div>'+
   '<div class="meta">Load ID '+esc(j.ref)+(j.customerRef?' | Customer Ref: '+esc(j.customerRef):'')+' | '+esc(j.vehicle||'Vehicle not supplied')+'</div>'+
   '<div class="badges"><span class="badge '+(b==='completed'?'green':'orange')+'">'+esc(badge(j))+'</span>'+(j.paymentTerms?'<span class="badge payment">'+esc(j.paymentTerms)+'</span>':'')+'</div>'+
   '<div class="route"><div class="stop"><div class="pin">1</div><div><div class="place">'+esc(place(j.pickupPostcode))+'</div><div class="time">'+esc(when(j.collectionStart,j.collectionEnd))+'</div></div></div><div class="stop"><div class="pin">2</div><div><div class="place">'+esc(place(j.deliveryPostcode))+'</div><div class="time">'+esc(when(j.deliveryStart,j.deliveryEnd))+'</div></div></div></div>'+
   '<div class="details">'+esc(cargo)+'</div>'+
   (b==='completed'&&pod?'<a class="primary" href="pod.html?job='+encodeURIComponent(j.id)+'" onclick="event.stopPropagation()">View POD</a>':'<a class="primary" href="'+target+'" onclick="event.stopPropagation()">View Job</a>')+
   '</article>';
 }
 const ordered=[...data].sort((a,b)=>sortValue(a)-sortValue(b));
 screen.innerHTML=ordered.map(card).join('');

 const historyWrap=document.createElement('div');
 historyWrap.id='booking-history-filter';
 historyWrap.style.display='none';
 historyWrap.innerHTML='<div id="booking-range-filter" class="finance-tabs"><button data-days="7">7 days</button><button data-days="14">14 days</button><button data-days="28" class="active">28 days</button></div>'+
  '<div class="panel booking-calendar-panel"><div class="booking-calendar-head"><button id="bookingCalendarPrev" class="icon-btn" type="button" aria-label="Previous month">&#8249;</button><strong id="bookingCalendarLabel"></strong><button id="bookingCalendarNext" class="icon-btn" type="button" aria-label="Next month">&#8250;</button></div>'+
  '<div class="booking-calendar-jump"><input id="bookingMonth" type="month" class="form-input"><button id="bookingCalendarToday" class="secondary" type="button">Today</button></div>'+
  '<div class="booking-calendar-weekdays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div id="bookingCalendarGrid" class="booking-calendar-grid"></div><div id="bookingCalendarSelection" class="details">Select a day to filter completed bookings.</div></div>';
 screen.insertAdjacentElement('afterbegin',historyWrap);

 const tabButtons=[...tabs.querySelectorAll('[data-booking-mode]')],range=historyWrap.querySelector('#booking-range-filter'),monthInput=historyWrap.querySelector('#bookingMonth'),grid=historyWrap.querySelector('#bookingCalendarGrid'),label=historyWrap.querySelector('#bookingCalendarLabel'),selection=historyWrap.querySelector('#bookingCalendarSelection');
 let currentMode='active',calendarMonth=new Date();
 calendarMonth=new Date(Date.UTC(calendarMonth.getUTCFullYear(),calendarMonth.getUTCMonth(),1));
 const counts=new Map();
 ordered.filter(j=>bucket(j)==='completed').forEach(j=>{const k=completionKey(j);if(k)counts.set(k,(counts.get(k)||0)+1)});

 function cards(){return [...screen.querySelectorAll('.booking-card')]}
 function updateEmpty(copy){
  const visible=cards().filter(c=>c.style.display!=='none').length;
  let empty=document.getElementById('bookings-empty-state');
  if(!visible){
   if(!empty){empty=document.createElement('div');empty.id='bookings-empty-state';empty.className='panel';screen.appendChild(empty)}
   empty.innerHTML='<div class="panel-title">No '+(currentMode==='completed'?'completed ':currentMode+' ')+'bookings</div><div class="details">'+copy+'</div>';
   empty.style.display='block';
  }else if(empty)empty.style.display='none';
 }
 function showBucket(mode,pred){
  currentMode=mode;
  tabButtons.forEach(b=>b.classList.toggle('active',b.dataset.bookingMode===mode));
  cards().forEach(c=>{const ok=c.dataset.bucket===mode&&(!pred||pred(c.dataset.date||''));c.style.display=ok?'block':'none'});
  const copy=mode==='active'?'Jobs requiring action now will appear here.':mode==='upcoming'?'Awarded or allocated jobs scheduled for later will appear here.':'Delivered and closed jobs will appear here.';
  updateEmpty(copy);
 }
 function renderCalendar(selected){
  const y=calendarMonth.getUTCFullYear(),m=calendarMonth.getUTCMonth(),first=new Date(Date.UTC(y,m,1)),days=new Date(Date.UTC(y,m+1,0)).getUTCDate(),lead=(first.getUTCDay()+6)%7;
  label.textContent=first.toLocaleDateString('en-GB',{timeZone:'UTC',month:'long',year:'numeric'});
  monthInput.value=y+'-'+String(m+1).padStart(2,'0');
  let html='';
  for(let i=0;i<lead;i++)html+='<span class="booking-calendar-blank"></span>';
  for(let day=1;day<=days;day++){const key=y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),n=counts.get(key)||0;html+='<button type="button" class="booking-calendar-day'+(key===selected?' active':'')+'" data-calendar-day="'+key+'"><span>'+day+'</span>'+(n?'<small>'+n+'</small>':'')+'</button>'}
  grid.innerHTML=html;
  grid.querySelectorAll('[data-calendar-day]').forEach(b=>b.onclick=()=>{const k=b.dataset.calendarDay;range.querySelectorAll('button').forEach(x=>x.classList.remove('active'));renderCalendar(k);selection.textContent=new Date(k+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'Europe/London',weekday:'long',day:'numeric',month:'long',year:'numeric'});showBucket('completed',d=>d===k)});
 }
 function applyRange(days){
  const today=Date.parse(ukDateKey(new Date())+'T12:00:00Z'),ms=days*86400000;
  range.querySelectorAll('button').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===days));
  selection.textContent='Showing completed jobs from the last '+days+' days.';
  showBucket('completed',k=>{const d=Date.parse(k+'T12:00:00Z');return!Number.isNaN(d)&&d<=today&&today-d<=ms});
 }
 function showMode(mode){
  if(!['active','upcoming','completed'].includes(mode))mode='active';
  historyWrap.style.display=mode==='completed'?'block':'none';
  if(mode==='completed'){applyRange(28);renderCalendar()}else showBucket(mode);
  const url=mode==='active'?'bookings.html':'bookings.html?tab='+mode;
  if(location.href.split('/').pop()!==url)history.replaceState(null,'',url);
 }
 tabButtons.forEach(b=>b.onclick=()=>showMode(b.dataset.bookingMode));
 range.querySelectorAll('button').forEach(b=>b.onclick=()=>applyRange(Number(b.dataset.days)));
 historyWrap.querySelector('#bookingCalendarPrev').onclick=()=>{calendarMonth=new Date(Date.UTC(calendarMonth.getUTCFullYear(),calendarMonth.getUTCMonth()-1,1));renderCalendar()};
 historyWrap.querySelector('#bookingCalendarNext').onclick=()=>{calendarMonth=new Date(Date.UTC(calendarMonth.getUTCFullYear(),calendarMonth.getUTCMonth()+1,1));renderCalendar()};
 historyWrap.querySelector('#bookingCalendarToday').onclick=()=>{const now=new Date();calendarMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));renderCalendar(ukDateKey(now));selection.textContent='Today';range.querySelectorAll('button').forEach(x=>x.classList.remove('active'));showBucket('completed',k=>k===ukDateKey(now))};
 monthInput.onchange=()=>{if(/^\d{4}-\d{2}$/.test(monthInput.value)){const [y,m]=monthInput.value.split('-').map(Number);calendarMonth=new Date(Date.UTC(y,m-1,1));renderCalendar()}};

 const requested=new URLSearchParams(location.search).get('tab');
 showMode(['active','upcoming','completed'].includes(requested)?requested:'active');
 document.body.classList.add('live-ready');
})();
