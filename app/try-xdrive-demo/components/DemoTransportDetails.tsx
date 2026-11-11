"use client";
import type {ReactNode} from "react";
type Field={label:string;value?:ReactNode};
export default function DemoTransportDetails({title,subtitle,status,sections,onClose,footer}:{title:string;subtitle:string;status?:string;sections:{title:string;fields:Field[]}[];onClose:()=>void;footer?:ReactNode}){
return <div className="xd-detail-overlay" onClick={onClose}><section className="xd-detail-dialog" role="dialog" aria-modal="true" aria-label={"Full details "+title} onClick={e=>e.stopPropagation()}>
<header className="xd-detail-header"><div><small>TRANSPORT DETAILS</small><h2>{title}</h2><p>{subtitle}</p></div><div><span className="xd-detail-status">{status||"Details"}</span><button onClick={onClose} aria-label="Close details">×</button></div></header>
<div className="xd-detail-content">{sections.map((s,i)=><section className="xd-detail-section" key={i}><h3>{s.title}</h3><div className="xd-detail-fields">{s.fields.map((f,j)=><div className="xd-detail-field" key={j}><small>{f.label}</small><strong>{f.value===undefined||f.value===null||f.value===""?"Not provided":f.value}</strong></div>)}</div></section>)}</div>
<footer className="xd-detail-footer">{footer}<button onClick={onClose}>Close Details</button></footer>
</section></div>}
