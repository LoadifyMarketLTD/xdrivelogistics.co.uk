"use client";
import {useEffect,useState} from "react";
import {authenticatedDemoFetch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
type Partner={id:string;name:string;area:string;type:string};
export default function DemoMemberDirectory(){
 const [search,setSearch]=useState("");
 const [items,setItems]=useState<Partner[]>([]);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState<string>("");
 useEffect(()=>{
  let active=true;
  const run=async()=>{
   try{
    const response=await authenticatedDemoFetch("/api/try-xdrive-demo/directory?q="+encodeURIComponent(search),{cache:"no-store"});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error||"Directory unavailable");
    if(active){setItems(Array.isArray(payload)?payload:[]);setError("")}
   }catch(e){if(active){setItems([]);setError(e instanceof Error?e.message:"Directory unavailable")}}
  };
  void run();
  return()=>{active=false};
 },[search]);
 const profile=items.find(p=>p.id===selected);
 return <div className="panel"><div className="panel-title"><h2>Member Directory</h2><span>XDRIVE MEMBERS</span></div>
  <label className="network-search">Find company, town or postcode<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search directory"/></label>
  {error&&<p role="alert">{error}</p>}
  {!error&&items.length===0&&<p className="muted">No visible members match this search.</p>}
  <div className="network-directory">{items.map(p=><button key={p.id} className={selected===p.id?"selected":""} onClick={()=>setSelected(p.id)}><strong>{p.name}</strong><small>{p.area||"Location undisclosed"}</small><span>{p.type}</span></button>)}</div>
  {profile&&<div className="network-profile"><h3>{profile.name}</h3><div className="facts"><span>{profile.area||"Location undisclosed"}</span><span>{profile.type}</span></div></div>}
  <p className="muted">Only company details authorized by XDrive production row-level security are displayed. No fictional compliance scores.</p>
 </div>
}
