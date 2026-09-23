(function(){
 'use strict';
 const Api=window.XDriveApi,R=window.XDRIVE_REAL||{};
 if(!Api)return;
 const q=new URLSearchParams(location.search),jobId=q.get('job')||'';
 const list=document.getElementById('conversationList'),messages=document.getElementById('messages');
 const heading=document.getElementById('conversationHeading'),title=document.getElementById('threadTitle');
 const input=document.getElementById('messageInput'),send=document.getElementById('sendBtn'),back=document.getElementById('msgBack');
 let threads=[],active=null;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stamp=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'';
 function load(){const r=Api.get('/api/driver/messages');if(!Api.ok(r)){list.innerHTML='<div class="details">'+esc(Api.error(r))+'</div>';send.disabled=true;return}threads=Array.isArray(r.body&&r.body.threads)?r.body.threads:[];selectInitial();renderThreads();renderMessages()}
 function selectInitial(){
  if(jobId)active=threads.find(t=>t&&t.context&&String(t.context.jobId)===jobId)||null;
  else active=threads[0]||null;
  if(jobId){heading.textContent='Direct job conversation';list.style.display='none';const isBooking=(R.bookings||[]).some(j=>j.id===jobId);back.href=(isBooking?'booking-detail.html?job=':'detail.html?job=')+encodeURIComponent(jobId)}
 }
 function renderThreads(){
  if(jobId)return;
  list.innerHTML='';
  if(!threads.length){list.innerHTML='<div class="details">No conversations available.</div>';return}
  threads.forEach(t=>{const b=document.createElement('button');b.className='conversation'+(active&&active.key===t.key?' active':'');const ref=t.context&&t.context.loadRef?' · '+t.context.loadRef:'';b.innerHTML='<strong>'+esc(t.counterpartName||t.counterpartCompanyName||'Participant')+'</strong><span>'+esc((t.counterpartCompanyName||'')+ref)+'</span>';b.onclick=()=>{active=t;renderThreads();renderMessages()};list.appendChild(b)})
 }
 function renderMessages(){
  messages.innerHTML='';
  if(!active){title.textContent=jobId?'Start job conversation':'Select a conversation';messages.innerHTML='<div class="details">'+(jobId?'Send the first message to the verified posting-company participant for this assigned job.':'Select a conversation to view messages.')+'</div>';send.disabled=!jobId;input.disabled=!jobId;return}
  title.textContent=(active.counterpartName||active.counterpartCompanyName||'Conversation')+(active.context&&active.context.loadRef?' · '+active.context.loadRef:'');
  const rows=Array.isArray(active.messages)?active.messages:[];
  if(!rows.length)messages.innerHTML='<div class="details">No messages yet.</div>';
  rows.forEach(m=>{const d=document.createElement('div');d.className='message-bubble '+(m.direction==='outbound'?'me':'them');d.innerHTML='<div>'+esc(m.body||'')+'</div><small>'+esc(stamp(m.createdAt))+'</small>';messages.appendChild(d)});
  messages.scrollTop=messages.scrollHeight;send.disabled=!active.canReply;input.disabled=!active.canReply;
 }
 function sendMessage(){
  const body=input.value.trim();if(!body)return;
  if(active&&!active.canReply)return;
  if(!active&&!jobId)return;
  send.disabled=true;const old=send.textContent;send.textContent='Sending...';
  const payload=active?{conversationId:active.conversationId,body}:{jobId,body};
  const r=Api.post('/api/driver/messages',payload);
  if(!Api.ok(r)){alert(Api.error(r));send.disabled=false;send.textContent=old;return}
  input.value='';send.textContent=old;load();
 }
 send.onclick=sendMessage;
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
 load();
})();
