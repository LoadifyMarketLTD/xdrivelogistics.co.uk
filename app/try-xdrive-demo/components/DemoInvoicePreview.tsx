"use client";

import {useState} from "react";
import type {DemoLoad} from "./demoExchange";

export default function DemoInvoicePreview({booking}:{booking:DemoLoad}){
 const [open,setOpen]=useState(false);
 if(!booking.podReceived)return null;
 const price=Number(booking.quote);
 const valid=Number.isFinite(price)&&price>0;
 const vat=valid?Math.round(price*20)/100:0;
 const total=valid?price+vat:0;
 return <section className="panel" aria-label="Invoice preview">
  <h3>Invoice Preview</h3>
  <p className="notice">Sample preview only. No VAT invoice is issued, no PDF is stored and no email is sent.</p>
  {!valid?<p role="status">A confirmed booking price is required before preparing a preview.</p>:<>
   <button type="button" className="outline" aria-expanded={open} onClick={()=>setOpen(x=>!x)}>{open?"Close preview":"Open invoice preview"}</button>
   {open&&<div className="panel" style={{background:"#fff",color:"#1A1F2B",padding:20,maxWidth:760}} role="region" aria-label="Sample A4 invoice">
    <header><h2>XDrive Logistics — Invoice Preview</h2><small>DEMO · NOT A TAX INVOICE · NOT ISSUED</small></header>
    <p>Job reference: {booking.id}</p>
    <p>Collection: {booking.from}</p>
    <p>Delivery: {booking.to}</p>
    <p>Service: {booking.vehicle}</p>
    <p>Payment terms: {booking.paymentTerms||"To be agreed by contracting parties"}</p>
    <table style={{width:"100%"}}><tbody>
     <tr><th align="left">Description</th><th align="right">Amount (GBP)</th></tr>
     <tr><td>Completed transport service</td><td align="right">£{price.toFixed(2)}</td></tr>
     <tr><td>Illustrative VAT (20%)</td><td align="right">£{vat.toFixed(2)}</td></tr>
     <tr><th align="left">Illustrative total</th><th align="right">£{total.toFixed(2)}</th></tr>
    </tbody></table>
    <p><small>The preview has no invoice number, legal supplier identity, tax point or issuance record and must not be used for payment or VAT accounting.</small></p>
   </div>}
  </>}
 </section>;
}
