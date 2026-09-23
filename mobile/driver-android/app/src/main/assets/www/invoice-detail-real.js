(function(){
 'use strict';
 const R=window.XDRIVE_REAL||{},id=new URLSearchParams(location.search).get('id'),i=(R.invoices||[]).find(x=>(x.number||x.id)===id||x.id===id);
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
 if(!i){set('invoiceNo','Invoice unavailable');set('invoiceStatus','NOT FOUND');document.getElementById('invoicePreview').disabled=true;return}
 const job=(R.bookings||[]).find(j=>j.id===i.jobId),payment=String(i.payment||'').toLowerCase(),status=String(i.status||'').toLowerCase();
 set('invoiceNo',i.number||i.id);set('invoiceClient',i.client||'Not supplied');set('invoiceJob',(job&&job.ref)||i.jobRef||'Not linked');set('invoiceAmount','£'+Number(i.amount||0).toFixed(2));set('invoiceDue',i.due||'Not set');set('invoiceTerms',String(i.terms||'').toUpperCase()||'Not supplied');set('invoiceStatus',payment==='paid'?'PAID':(status==='draft'||status.includes('pending'))?'PENDING APPROVAL':'OUTSTANDING');
 document.getElementById('invoicePreview').onclick=()=>location.href='invoice-preview.html?id='+encodeURIComponent(i.number||i.id);
 const pod=document.getElementById('invoicePod');if(job){pod.style.display='inline-flex';pod.onclick=()=>location.href='pod.html?job='+encodeURIComponent(job.id)}
})();

if(document.body)document.body.classList.add('live-ready');
