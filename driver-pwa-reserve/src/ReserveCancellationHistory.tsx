import {useEffect,useState} from 'react';
import {driverGet,type LiveSession} from './liveApi';
type RecordRow={id:string;status:string;reason:string;created_at:string;decision_notes?:string};
export default function ReserveCancellationHistory({jobId,session,onRequest}:{jobId:string;session:LiveSession;onRequest?:()=>void}){
 const [rows,setRows]=useState<RecordRow[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setRows(null);setError('');void driverGet('/mobile/jobs/'+encodeURIComponent(jobId)+'/cancellation-request',session.token,25000).then(r=>{if(r.ok!==true||!Array.isArray(r.requests))throw new Error('Cancellation history unavailable');if(alive)setRows(r.requests as RecordRow[])}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Cancellation history unavailable')});return()=>{alive=false};},[jobId,session.token]);
 if(!rows&&!error)return <p className="rv-sub">Checking cancellation requests…</p>;
 if(error)return <p className="rv-warning" role="alert">{error}</p>;
 if(!rows?.length)return onRequest?<button className="rv-outline rv-wide" onClick={onRequest}>Request Booking Cancellation</button>:null;
 return <section className="rv-card"><h3>Cancellation requests</h3>{rows.map(row=><details key={row.id} open={row.status==='pending'}><summary>{row.status==='pending'?'Awaiting approval':row.status==='approved'?'Approved — verify booking status':row.status==='rejected'?'Rejected':row.status}</summary><p>{new Date(row.created_at).toLocaleString('en-GB')}</p><p>{row.reason}</p>{row.decision_notes&&<p>{row.decision_notes}</p>}{row.status==='pending'&&<p className="rv-warning">Request only. Await authorised instructions before returning or redirecting goods.</p>}</details>)}{onRequest&&!rows.some(row=>row.status==='pending')&&<button className="rv-outline rv-wide" onClick={onRequest}>Request Booking Cancellation</button>}</section>;
}