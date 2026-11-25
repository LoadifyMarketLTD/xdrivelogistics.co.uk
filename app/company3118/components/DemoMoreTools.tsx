"use client";
import {useState} from "react";
import DemoOperationalTools from "./DemoOperationalTools";
export default function DemoMoreTools({role}:{role:"Fleet"|"Broker"|"Customer"|"Company"|"Dispatcher"}){const options=["Return Journeys","Directory","Messages","Invoices & Earnings","Reports & Statistics","Event Log","Help & Support","Availability","Notifications"];const [active,setActive]=useState(options[0]);return <div className="panel"><h2>{role} workspace tools</h2><div className="steps">{options.map((x,i)=><button key={x} onClick={()=>setActive(x)}><b>{i+1}</b><span>{x}</span></button>)}</div><DemoOperationalTools key={role+active} tool={active} role={role}/></div>}
