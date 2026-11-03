"use client";
import {useEffect,useState} from "react";
type Props={label:string;value:string;onChange:(value:string)=>void;invalid:boolean;placeholder:string;onAddressSelect?:(address:string)=>void};
type Result={suggestions?:string[];addresses?:string[];streets?:string[];area?:string;display?:string;complete?:boolean;error?:string};
export default function DemoPostcodeField({label,value,onChange,invalid,placeholder,onAddressSelect}:Props){
 const [postcode,setPostcode]=useState("");
 const [suggestions,setSuggestions]=useState<string[]>([]);
 const [addresses,setAddresses]=useState<string[]>([]);
 const [streets,setStreets]=useState<string[]>([]);
 const [area,setArea]=useState("");
 const [message,setMessage]=useState("");
 const [pending,setPending]=useState(false);
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  const compact=postcode.toUpperCase().replace(/\s/g,"");
  if(compact.length<2){setSuggestions([]);setAddresses([]);setStreets([]);setArea("");setMessage("");setPending(false);return;}
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setPending(true);setMessage("");
   try{
    const response=await fetch("/api/try-xdrive-demo/postcode?postcode="+encodeURIComponent(postcode),{signal:controller.signal});
    const data:Result=await response.json();
    if(!response.ok)throw Error(data.error||"Lookup failed");
    setSuggestions(data.suggestions||[]);
    setAddresses(data.addresses||[]);
    setStreets(data.streets||[]);
    setArea(data.area||"");
    if(data.complete&&data.display){
     onChange(data.display);
     setOpen(false);
     setMessage(data.addresses?.length?"Select an address below, or enter it manually.":"Confirmed: "+data.display+". "+(data.streets?.length?"Choose a nearby street, add building number and verify the full address.":"Enter the full address manually."));
    }
   }catch(e){if(!controller.signal.aborted){setSuggestions([]);setAddresses([]);setStreets([]);setArea("");setMessage(e instanceof Error?e.message:"Lookup failed")}}
   finally{if(!controller.signal.aborted)setPending(false)}
  },300);
  return()=>{clearTimeout(timer);controller.abort()};
 },[postcode,onChange]);
 const id=label.startsWith("Collection")?"demo-collection-suggestions":"demo-delivery-suggestions";
 return <div className="post-postcode">
  <label className="post-field">UK postcode lookup
   <input value={postcode} onFocus={()=>setOpen(true)} onChange={e=>{setPostcode(e.target.value.toUpperCase());setOpen(true);setSuggestions([]);setAddresses([]);setStreets([]);setArea("");setMessage("")}} placeholder="Start typing e.g. BB1" autoComplete="off" aria-label={label+" postcode lookup"} aria-expanded={open&&suggestions.length>0} aria-controls={id} aria-autocomplete="list"/>
  </label>
  {pending&&<small role="status">Searching postcode...</small>}
  {area&&<small role="status">Area: {area}</small>}
  {open&&suggestions.length>0&&<div className="post-postcode-suggestions" role="listbox" id={id} aria-label={label+" postcode suggestions"}>
   {suggestions.map(s=><button type="button" role="option" aria-selected={false} key={s} onClick={()=>{setPostcode(s);setSuggestions([]);setOpen(false);setMessage("Checking selected postcode...")}}>{s}</button>)}
  </div>}
  <label className="post-field">{label} <em>*</em><input className={invalid?"post-invalid":""} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={label}/></label>
  {addresses.length>0&&onAddressSelect&&<label className="post-field">Select full address (private)<select aria-label={label+" address selection"} defaultValue="" onChange={e=>{if(e.target.value)onAddressSelect(e.target.value)}}><option value="">Choose an address</option>{addresses.map((a,i)=><option key={i} value={a}>{a}</option>)}</select></label>}
  {streets.length>0&&onAddressSelect&&<label className="post-field">Nearby streets (OpenStreetMap, approximate)<select aria-label={label+" street selection"} defaultValue="" onChange={e=>{if(e.target.value)onAddressSelect(e.target.value)}}><option value="">Choose a street, then add building number below</option>{streets.map(s=><option key={s} value={s}>{s}</option>)}</select><small>Street names are approximate; verify the building number and full address manually.</small></label>}
  {message&&<small role="status">{message}</small>}
  {invalid&&<small className="post-error">Required field</small>}
 </div>;
}
