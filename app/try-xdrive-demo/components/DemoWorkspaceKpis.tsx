"use client";
import type {ReactNode} from "react";

/** Company-approved XDrive KPI card. Every DEMO role shares its visual anatomy. */
export type DemoWorkspaceKpiItem = {
 label:string;
 value:ReactNode;
 sub:string;
 icon:string;
 color:"orange"|"blue"|"green"|"amber"|"sky";
 onClick:()=>void;
};
export default function DemoWorkspaceKpis({items}:{items:readonly DemoWorkspaceKpiItem[]}){
 return <div className="xd-dashboard-kpis" aria-label="Workspace performance indicators">
  {items.map(item=><button key={item.label} type="button" className={"xd-kpi "+item.color} onClick={item.onClick}>
   <span className="xd-kpi-icon" aria-hidden="true">{item.icon}</span>
   <span className="xd-kpi-content"><strong>{item.label}</strong><b>{item.value}</b><small>{item.sub}</small></span>
  </button>)}
 </div>;
}
