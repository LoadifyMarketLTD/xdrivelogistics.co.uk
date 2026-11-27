"use client";
import {useEffect,useState} from "react";
type RecordData={id:string;fields:Record<string,string>};
const schema:Record<string,{label:string;fields:[string,string,string?][]}>={
"Return Journeys":{label:"Plan a return journey",fields:[["origin","Collection town / outcode"],["destination","Destination town / outcode"],["date","Departure date","date"],["time","Departure time","time"],["vehicle","Vehicle / capacity"],["notes","Notes"]]},
"Availability":{label:"Update availability",fields:[["area","Current town / outcode"],["from","Available from","datetime-local"],["until","Available until","datetime-local"],["vehicle","Vehicle"],["status","Status"]]},
"Messages":{label:"Compose demo message",fields:[["recipient","Recipient / company"],["subject","Subject"],["message","Message"]]},
"Invoices & Earnings":{label:"Create demo invoice",fields:[["reference","Invoice reference"],["job","Job ID"],["amount","Amount GBP","number"],["due","Due date","date"],["status","Payment status"]]},
"Directory":{label:"Add demo contact",fields:[["company","Company name"],["member","Member ID"],["town","Town / outcode"],["phone","Phone"]]},
"Notifications":{label:"Configure demo alert",fields:[["type","Alert type"],["radius","Radius miles","number"],["vehicle","Vehicle"],["channel","Notification channel"]]},
"Reports & Statistics":{label:"Create report filter",fields:[["metric","Metric"],["from","From","date"],["to","To","date"]]},
"Event Log":{label:"Add event note",fields:[["event","Event"],["job","Job reference"],["notes","Notes"]]},
"Help & Support":{label:"Create demo support request",fields:[["subject","Subject"],["priority","Priority"],["details","Description"]]},
"Who's Nearby":{label:"Search nearby demo members",fields:[["town","Town / outcode"],["radius","Radius miles","number"],["vehicle","Vehicle"]]},
"My Vehicles":{label:"Manage own vehicle",fields:[["registration","Registration"],["type","Vehicle type"],["height","Height metres","number"],["capacity","Payload kg","number"],["status","Status"]]},
"Driver Profile":{label:"Edit driver profile",fields:[["name","Name"],["phone","Contact number"],["licence","Licence category"],["home","Home outcode"]]},
"My Company":{label:"View company profile",fields:[["company","Company"],["member","Member ID"],["contact","Dispatch contact"]]}
};
export default function DemoOperationalTools({tool,role}:{tool:string;role:string}){
const definition=schema[tool]||{label:tool,fields:[["details","Details"]] as [string,string,string?][]};
const key="xdrive-demo-tools-v2:"+role+":"+tool;
const [records,setRecords]=useState<RecordData[]>([]),[form,setForm]=useState<Record<string,string>>({}),[edit,setEdit]=useState<string|null>(null),[ready,setReady]=useState(false);
useEffect(()=>{try{const parsed=JSON.parse(localStorage.getItem(key)||"[]");setRecords(Array.isArray(parsed)?parsed:[])}catch{setRecords([])}setForm({});setEdit(null);setReady(true)},[key]);
function persist(next:RecordData[]){setRecords(next);localStorage.setItem(key,JSON.stringify(next))}
const required=definition.fields.slice(0,Math.min(2,definition.fields.length));
return <section className="panel"><h3>{definition.label}</h3><p className="notice">Fictional {role} records only. Saved in this browser, not the live platform.</p><div className="form-grid">{definition.fields.map(([id,label,type])=><label key={id}>{label}<input type={type||"text"} aria-label={label} value={form[id]||""} onChange={e=>setForm(x=>({...x,[id]:e.target.value}))}/></label>)}</div><div className="actions"><button className="primary" disabled={!ready||required.some(([id])=>!form[id]?.trim())} onClick={()=>{const next:RecordData={id:edit||"DEMO-"+Date.now(),fields:{...form}};persist(edit?records.map(x=>x.id===edit?next:x):[next,...records]);setEdit(null);setForm({})}}>{edit?"Save changes":"Add / Save"}</button>{edit&&<button className="outline" onClick={()=>{setEdit(null);setForm({})}}>Cancel edit</button>}</div>{records.map(r=><div className="fleet-row" key={r.id}><div><strong>{Object.values(r.fields).filter(Boolean).slice(0,2).join(" · ")}</strong><small>{Object.entries(r.fields).filter(([,v])=>v).slice(2).map(([k,v])=>k+": "+v).join(" · ")}</small></div><div className="actions"><button className="outline" onClick={()=>{setEdit(r.id);setForm({...r.fields})}}>Edit</button><button className="outline" onClick={()=>{persist(records.filter(x=>x.id!==r.id));if(edit===r.id){setEdit(null);setForm({})}}}>Remove</button></div></div>)}</section>
}
