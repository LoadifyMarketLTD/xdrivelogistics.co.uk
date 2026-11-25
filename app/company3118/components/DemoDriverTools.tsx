"use client";
import {useState} from "react";
import DemoCompliance from "./DemoCompliance";
import DemoOperationalTools from "./DemoOperationalTools";
const ownerTools=["Driver Profile","My Vehicles","Documents & Compliance","Invoices & Earnings","Event Log","Return Journeys","Availability","Who's Nearby","Directory","Messages","Help & Support"];
const companyTools=["Driver Profile","My Company","Documents & Compliance","Availability","Event Log","Help & Support"];
export default function DemoDriverTools({role}:{role:string}){
const names=role==="Owner Driver"?ownerTools:companyTools;
const [active,setActive]=useState(names[0]);const vehicle=role==="Owner Driver"?[{id:"demo-van",reg:"DX26 DEM"}]:[];
return <div className="panel"><div className="panel-title"><h2>More · {role}</h2><span>DEMO TOOLS</span></div><p className="notice">Fictional workspace tools. Records are local to this page and do not update real accounts.</p><div className="form-grid">{names.map(n=><button className={active===n?"primary":"outline"} key={n} onClick={()=>{setActive(n)}}>{n} →</button>)}</div><div className="panel"><h3>{active}</h3>{active==="Documents & Compliance"?<DemoCompliance drivers={["Demo Driver"]} vehicles={vehicle} scope={role}/>:<DemoOperationalTools key={role+active} role={role} tool={active}/>}</div></div>
}
