(function(){
'use strict';
const Api=window.XDriveApi;if(!Api)return;
const frame=document.getElementById('nearbyMapFrame'),markers=document.getElementById('nearbyMapMarkers'),legend=document.getElementById('nearbyMapLegend'),list=document.getElementById('nearbyMapList'),external=document.getElementById('nearbyMapExternal'),tabs=[...document.querySelectorAll('[data-map-tab]')];
let rows=[],mode='all';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Number(p.lat)>=-90&&Number(p.lat)<=90&&Number(p.lng)>=-180&&Number(p.lng)<=180;
const activeRows=()=>rows.filter(valid).filter(p=>mode==='all'||p.scope===mode);
function render(){
 const r=activeRows();markers.innerHTML='';list.innerHTML='';
 if(!r.length){frame.removeAttribute('src');legend.textContent='No nearby availability in this view.';external.style.display='none';document.body.classList.add('live-ready');return}
 let minLat=Math.min(...r.map(p=>Number(p.lat))),maxLat=Math.max(...r.map(p=>Number(p.lat))),minLng=Math.min(...r.map(p=>Number(p.lng))),maxLng=Math.max(...r.map(p=>Number(p.lng)));
 const padLat=Math.max(.02,(maxLat-minLat)*.22),padLng=Math.max(.03,(maxLng-minLng)*.22);minLat-=padLat;maxLat+=padLat;minLng-=padLng;maxLng+=padLng;
 frame.src='https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent([minLng,minLat,maxLng,maxLat].join(','))+'&layer=mapnik';
 const centerLat=(minLat+maxLat)/2,centerLng=(minLng+maxLng)/2;external.href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(centerLat.toFixed(5))+'&mlon='+encodeURIComponent(centerLng.toFixed(5))+'#map=10/'+encodeURIComponent(centerLat.toFixed(5))+'/'+encodeURIComponent(centerLng.toFixed(5));external.style.display='grid';
 r.forEach((p,i)=>{const x=(Number(p.lng)-minLng)/(maxLng-minLng)*100,y=(maxLat-Number(p.lat))/(maxLat-minLat)*100;const m=document.createElement('div');m.style.cssText='position:absolute;left:'+x+'%;top:'+y+'%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:'+(p.scope==='fleet'?'#0E3FA9':'#F5A300')+';color:'+(p.scope==='fleet'?'#fff':'#172033')+';display:grid;place-items:center;font:800 12px Arial;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.25);pointer-events:none';m.textContent=String(i+1);markers.appendChild(m)});
 legend.textContent=r.length+' available position'+(r.length===1?'':'s')+' · Blue = Fleet · Orange = Exchange';
 list.innerHTML=r.map((p,i)=>'<div class="panel"><div class="info-row"><span><strong>'+esc((i+1)+'. '+(p.scope==='fleet'?'Fleet driver':p.member_name||'Exchange member'))+'</strong><br><small>'+esc(p.scope==='fleet'?'Exact company-only position':'Privacy-rounded Exchange area')+'</small></span><span class="badge '+(p.scope==='fleet'?'green':'orange')+'">'+esc(String(p.scope).toUpperCase())+'</span></div><div class="details">'+esc([p.vehicle_type,p.payload_kg!=null?p.payload_kg+' kg':null,p.pallets_capacity!=null?p.pallets_capacity+' pallets':null].filter(Boolean).join(' · '))+'</div></div>').join('');
 document.body.classList.add('live-ready');
}
function load(){const r=Api.get('/api/availability/nearby');if(!Api.ok(r)){legend.textContent=Api.error(r);document.body.classList.add('live-ready');return}rows=Array.isArray(r.body.positions)?r.body.positions:[];render()}
tabs.forEach(b=>b.onclick=()=>{mode=b.dataset.mapTab||'all';tabs.forEach(x=>x.classList.toggle('active',x===b));render()});load();
})();