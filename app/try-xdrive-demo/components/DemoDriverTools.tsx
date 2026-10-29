"use client";
import {useState} from "react";
export default function DemoDriverTools({role}:{role:string}) {
const names=role==="Owner Driver"?["Driver Profile","Invoices & Earnings","Event Log","Return Journeys","Availability","Who's Nearby","Directory","Messages","Help & Support"]:["Driver Profile","My Company","Availability","Event Log","Help & Support"];
const [active,setActive]=useState(names[0]);
const [value,setValue]=useState("");
const [records,setRecords]=useState<Record<string,string[]>>({});
return <div className="panel"><h2>Driver tools</h2><div className="steps">{names.map(n=><button key={n} onClick={()=>{setActive(n);setValue("")}}>{n}</button>)}</div><h3>{active}</h3><p>Fictional data only. No live operations.</p><label>Demo details<input value={value} onChange={e=>setValue(e.target.value)}/></label><button className="primary" disabled={!value.trim()} onClick={()=>{setRecords(x=>({...x,[active]:[...(x[active]||[]),value]}));setValue("")}}>Save demo details</button>{(records[active]||[]).map((x,i)=><p key={i}>{x} <button onClick={()=>setRecords(r=>({...r,[active]:r[active].filter((_,j)=>j!==i)}))}>Remove</button></p>)}</div>
}
