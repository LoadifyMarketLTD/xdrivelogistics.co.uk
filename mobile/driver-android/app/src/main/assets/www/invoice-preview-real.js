(function(){
'use strict';
const R=window.XDRIVE_REAL||{},id=new URLSearchParams(location.search).get('id'),i=(R.invoices||[]).find(x=>(x.number||x.id)===id||x.id===id);
const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'—'};
const money=v=>'£'+Number(v||0).toFixed(2);
const dt=(v,time)=>{if(!v)return'—';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return time?d.toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):d.toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric'})};
if(!i){document.getElementById('invoiceSheet').innerHTML='<div class="panel-title">Invoice unavailable</div><div class="details">This invoice could not be found in XDrive Finance.</div>';document.querySelector('.invoice-print-btn').style.display='none';return}
const job=(R.bookings||[]).find(j=>j.id===i.jobId),payment=String(i.payment||'').toLowerCase(),status=String(i.status||'').toLowerCase();
set('pNo',i.number||i.id);set('pStatus',payment==='paid'?'PAID':(status==='draft'||status.includes('pending'))?'PENDING APPROVAL':'OUTSTANDING');
set('pIssuer',i.issuerName||((R.profile&&R.profile.companyName)||'Invoice issuer'));set('pIssuerAddress',i.issuerAddress||'Business address held in XDrive');
set('pIssuerMeta',[i.issuerXdId?'XDrive ID '+i.issuerXdId:'',i.issuerCompanyNumber?'Company No. '+i.issuerCompanyNumber:'',i.issuerVatNumber?'VAT '+i.issuerVatNumber:''].filter(Boolean).join(' · '));
set('pClient',i.client||'Not supplied');set('pClientAddress',i.clientAddress||'Address not supplied');set('pClientMeta',[i.customerXdId?'XDrive ID '+i.customerXdId:'',i.customerCompanyNumber?'Company No. '+i.customerCompanyNumber:'',i.customerVatNumber?'VAT '+i.customerVatNumber:''].filter(Boolean).join(' · '));
set('pDate',dt(i.invoiceDate||i.date,false));set('pDue',dt(i.due,false));set('pJob',(job&&job.ref)||i.jobRef||'—');set('pLoad',i.loadId||((job&&job.ref)||'—'));set('pCustomerRef',i.customerRef||((job&&job.customerRef)||'—'));
set('pPickup',i.pickupLocation||((job&&job.pickupLocation)||'—'));set('pPickupTime',dt(i.pickupDateTime||((job&&job.collectionStart)||''),true));set('pDelivery',i.deliveryLocation||((job&&job.deliveryLocation)||'—'));set('pDeliveryTime',dt(i.deliveryDateTime||((job&&job.deliveryStart)||''),true));
set('pVehicle',[i.vehicleType||((job&&job.vehicle)||''),i.vehicleRegistration].filter(Boolean).join(' · '));set('pCargo',i.cargoSummary||((job&&job.pallets)?job.pallets+' pallet'+(Number(job.pallets)===1?'':'s')+(job.weight?' · '+job.weight+' kg':''):'Not supplied'));
set('pDelivered',dt(i.deliveredAt||i.deliveryDateTime,true));set('pRecipient',i.deliveryRecipient||((job&&job.clientSignatureName)||'Not supplied'));set('pLeftAt',i.leftAt||'Not recorded');set('pItems',i.noOfItems==null?'Not recorded':String(i.noOfItems));set('pDeliveryNotes',i.deliveryNotes||'No delivery notes recorded.');set('pPodState',i.podGenerated?'POD COMPLETE · evidence captured in XDrive':'POD status recorded in XDrive');
set('pDescription',i.serviceDescription||'Transport service');set('pNet',money(i.netAmount));set('pVat',money(i.vatAmount)+' ('+Number(i.vatRate||0)+'%)');set('pAmount',money(i.amount));set('pSubtotal',money(i.netAmount));set('pVatTotal',money(i.vatAmount));set('pGrandTotal',money(i.amount));
set('pPaymentDue','Please ensure payment is received by '+dt(i.due,false)+'.');set('pTerms','Payment terms: '+String(i.terms||'Not supplied').toUpperCase());
set('pBank',(i.bankAccountName&&i.bankSortCode&&i.bankAccountNumber)?('Account: '+i.bankAccountName+' · Sort code: '+i.bankSortCode+' · Account no: '+i.bankAccountNumber):'Bank details available from the invoice issuer.');
set('pFooter',[i.issuerName,i.issuerCompanyNumber?'Company No. '+i.issuerCompanyNumber:'',i.issuerVatNumber?'VAT '+i.issuerVatNumber:'',i.issuerXdId?'XDrive ID '+i.issuerXdId:'',i.issuerEmail,i.issuerPhone].filter(Boolean).join(' · '));
document.getElementById('previewBack').href='invoice-detail.html?id='+encodeURIComponent(i.number||i.id);
document.body.classList.add('live-ready');
})();