(function(){
 if((location.pathname.split('/').pop()||'').toLowerCase()!=='detail.html')return;
 const R=window.XDRIVE_REAL||{},q=new URLSearchParams(location.search),raw=q.get('job');
 const job=(R.jobs||[]).find(j=>j.id===raw||j.ref===raw);if(!job)return;
 const cta=document.getElementById('bid-cta');if(!cta||!window.XDriveApi)return;
 const row=document.createElement('div');row.className='load-detail-actions';
 const save=document.createElement('button');save.className='secondary';
 const dismiss=document.createElement('button');dismiss.className='danger';row.append(save,dismiss);cta.insertAdjacentElement('afterend',row);
 let state=job.preferenceState==='deleted'?'dismissed':job.preferenceState==='saved'?'saved':'available';
 const sync=()=>{save.textContent=state==='saved'?'Unsave':'Save';dismiss.textContent=state==='dismissed'?'Restore':'Dismiss';};
 const setPref=next=>{const server=next==='saved'?'saved':next==='dismissed'?'deleted':null,r=XDriveApi.post('/api/driver/mobile/resources',{action:'set_job_preference',jobId:job.id,state:server});if(!XDriveApi.ok(r)){alert(XDriveApi.error(r));return false}state=next;sync();return true};
 save.onclick=()=>setPref(state==='saved'?'available':'saved');
 dismiss.onclick=()=>{const next=state==='dismissed'?'available':'dismissed';if(setPref(next)&&next==='dismissed')location.href='index.html?tab=dismissed'};
 sync();
})();
