(function(){
 'use strict';
 const Api=window.XDriveApi,$=id=>document.getElementById(id),id=sessionStorage.getItem('xdrive-doc-preview-id')||'';if(!Api){return}
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function fail(text){$('docTitle').textContent='Document unavailable';$('docStatus').textContent='Unavailable';$('previewArea').textContent=text;document.body.classList.add('live-ready')}
 if(!id){fail('Return to Documents and select a document.');return}
 const r=Api.get('/api/driver/mobile/documents/'+encodeURIComponent(id));if(!Api.ok(r)){fail(Api.error(r));return}
 const d=r.body.document||{},url=String(r.body.signedUrl||'');$('docTitle').textContent=d.type||'Document';$('docStatus').textContent=d.status||'pending';$('docIssued').textContent=d.issuedDate||'Not supplied';$('docExpiry').textContent=d.expiryDate||'Not supplied';$('docScope').textContent=d.isVehicleDocument?'Vehicle':'Driver';$('docProblem').textContent=d.rejectionReason?('Review note: '+d.rejectionReason):(d.riskStatus&&d.riskStatus!=='clear'?('Risk status: '+d.riskStatus):'');
 if(!url){fail('The secure file URL is unavailable.');return}if(String(d.mimeType||'').startsWith('image/')){$('previewArea').innerHTML='<img alt="Secure document preview" src="'+esc(url)+'" style="display:block;max-width:100%;height:auto;border-radius:12px"><div class="details" style="margin-top:8px">This secure preview expires automatically.</div>'}else{$('previewArea').innerHTML='<div class="details">For security, PDF files open using a temporary signed link that expires after five minutes.</div><a class="primary" href="'+esc(url)+'" style="display:grid;place-items:center;text-decoration:none;margin-top:12px">Open secure document</a>'}document.body.classList.add('live-ready');
})();
