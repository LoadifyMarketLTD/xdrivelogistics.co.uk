import "server-only";
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from "node:fs";
import {join} from "node:path";
export type Load={id:string;from:string;to:string;vehicle:string;pallets:string;weight:string;customer:string;sell:string;postedAt:string;status:"Open"|"Awarded"|"Cancelled";quote?:number;driver?:string;awardedQuoteId?:string};
export type Quote={id:string;loadId:string;role:string;amount:number;createdAt:string;status:"Open"|"Withdrawn"};
type Data={loads:Load[];quotes:Quote[]};
const dir=join(process.cwd(),".local-tools","try-xdrive-demo");
const file=join(dir,"exchange.json");
const seed:Load={id:"XDL-DEMO-SHARED-1129",from:"Blackburn BB1",to:"Manchester M1",vehicle:"Luton Van",pallets:"2",weight:"450",customer:"XDrive Sample Customer",sell:"195",postedAt:"2026-10-29T11:51:00Z",status:"Open"};
function valid(v:unknown):v is Data{return !!v&&typeof v==="object"&&Array.isArray((v as Data).loads)&&Array.isArray((v as Data).quotes)}
export function readDemo():Data{mkdirSync(dir,{recursive:true});if(!existsSync(file)){const initial={loads:[seed],quotes:[]};writeDemo(initial);return initial}try{const v:unknown=JSON.parse(readFileSync(file,"utf8"));if(valid(v))return v}catch{throw Error("Demo storage JSON invalid: refusing to overwrite")}throw Error("Demo storage unreadable: refusing to overwrite")}
export function writeDemo(data:Data){mkdirSync(dir,{recursive:true});const tmp=file+".tmp";writeFileSync(tmp,JSON.stringify(data,null,2),"utf8");renameSync(tmp,file)}
