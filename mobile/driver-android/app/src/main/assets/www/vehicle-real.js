(function(){
 'use strict';
 const v=(window.XDRIVE_REAL||{}).vehicle;
 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||'Not supplied'};
 const pretty=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 if(!v){set('vehicleType','No assigned vehicle');set('vehicleReg','—');set('vehicleModel','—');set('vehicleStatus','Not assigned');set('vehicleAvailability','Unavailable');return}
 set('vehicleType',v.type||'Vehicle');set('vehicleReg',v.registration||'Not supplied');set('vehicleModel',[v.make,v.model].filter(Boolean).join(' ')||'Not supplied');set('vehicleStatus',pretty(v.status||'Unknown'));set('vehicleAvailability',v.available?'Available':'Unavailable');
})();

if(document.body)document.body.classList.add('live-ready');
