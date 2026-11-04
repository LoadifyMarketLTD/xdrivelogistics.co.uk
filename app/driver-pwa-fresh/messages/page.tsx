'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import {readRouteAuthAccessToken} from '../../../lib/routeAuthCookie';
import {FreshBottom,FreshHeader} from '../FreshNavigation';

type Message={id:string;body:string;createdAt:string|null;direction:'inbound'|'outbound'};
type Thread={key:string;conversationId:string|null;counterpartName:string;counterpartCompanyId:string|null;counterpartCompanyName:string|null;canReply:boolean;latestAt:string|null;context:{jobId:string}|null;messages:Message[]};
export default function DriverMobileMessages(){
 const params=useSearchParams(),jobId=params.get('jobId');
 const [threads,setThreads]=useState<Thread[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[draft,setDraft]=useState(''),[sending,setSending]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const token=await readRouteAuthAccessToken();if(!token)throw new Error('Sign in required.');
   const response=await fetch('/api/driver/messages',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const data=await response.json() as {threads?:Thread[];error?:string};
   if(!response.ok)throw new Error(data.error||'Messages unavailable.');
   const rows=data.threads||[];setThreads(rows);
   setSelected(previous=>previous&&rows.some(t=>t.key===previous)?previous:rows.find(t=>t.context?.jobId===jobId)?.key??null);
  }catch(e){setError(e instanceof Error?e.message:'Messages unavailable.');}
  finally{setLoading(false);}
 },[jobId]);
 useEffect(()=>{void refresh();},[refresh]);
 const target=threads.find(t=>t.key===selected)||null;
 const companyThreads=useMemo(()=>target?.counterpartCompanyId?threads.filter(t=>t.counterpartCompanyId===target.counterpartCompanyId):target?[target]:[],[target,threads]);
 const history=useMemo(()=>companyThreads.flatMap(t=>t.messages.map(m=>({...m,threadKey:t.key}))).sort((a,b)=>Date.parse(a.createdAt||'')-Date.parse(b.createdAt||'')),[companyThreads]);
 const send=async()=>{if(!target?.conversationId||!target.canReply||!draft.trim()||sending)return;setSending(true);setError('');
  try{const token=await readRouteAuthAccessToken();if(!token)throw new Error('Sign in required.');
   const response=await fetch('/api/driver/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({conversationId:target.conversationId,body:draft.trim()})});
   const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Message not sent.');setDraft('');await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Message not sent.');}finally{setSending(false);}
 };
 return <ProtectedRoute allowedRoles={['driver']}><FreshHeader title="Messages"/><main className="fresh-content" style={{paddingBottom:100}}>
 {error?<p role="alert" className="fresh-message">{error}</p>:null}
 {loading?<p className="fresh-message">Loading conversations…</p>:null}
 {!loading&&threads.length===0?<p className="fresh-message">No verified conversations yet. Messaging requires an existing conversation with the company.</p>:null}
 {!loading&&jobId&&!target?<p className="fresh-message">No verified conversation exists for this job. Choose an existing company conversation below.</p>:null}
 <section className="fresh-card" aria-label="Conversations"><h2>Company conversations</h2>
 {threads.map(t=><button key={t.key} type="button" onClick={()=>{setSelected(t.key);setDraft('');}} style={{display:'block',width:'100%',textAlign:'left',padding:12,marginTop:8,border:'1px solid #d5dce5',borderRadius:10,background:t.key===selected?'#eaf1fb':'white',color:'#0B2F6B'}}><strong>{t.counterpartCompanyName||t.counterpartName}</strong><div style={{fontSize:12}}>{t.latestAt?new Date(t.latestAt).toLocaleString('en-GB'):''}</div></button>)}
 </section>
 {target?<section className="fresh-card" aria-label="Message history"><h2>{target.counterpartCompanyName||target.counterpartName}</h2>
 {history.map(m=><div key={m.threadKey+':'+m.id} style={{margin:'10px 0',padding:12,borderRadius:10,background:m.direction==='outbound'?'#e8f2ff':'#f4f6f8',marginLeft:m.direction==='outbound'?25:0,marginRight:m.direction==='inbound'?25:0}}><div style={{whiteSpace:'pre-wrap'}}>{m.body}</div><small>{m.createdAt?new Date(m.createdAt).toLocaleString('en-GB'):''}</small></div>)}
 {target.canReply?<><label htmlFor="mobile-reply">Reply</label><textarea id="mobile-reply" value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} rows={3} style={{width:'100%',padding:12,borderRadius:8}}/><button type="button" disabled={!draft.trim()||sending} onClick={()=>void send()} style={{minHeight:48,width:'100%',background:'#16A34A',color:'white',border:0,borderRadius:8}}>{sending?'Sending…':'Send message'}</button></>:<p>Reply unavailable for this historical conversation.</p>}
 </section>:null}
 </main><FreshBottom active="jobs"/></ProtectedRoute>;
}
