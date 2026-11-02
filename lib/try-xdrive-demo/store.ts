import "server-only";
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from "node:fs";
import {join} from "node:path";
export type Load={id:string;from:string;to:string;vehicle:string;pallets:string;weight:string;customer:string;sell:string;pickupDate?:string;deliveryDate?:string;pickupStart?:string;pickupEnd?:string;deliveryTime?:string;deliveryMode?:string;service?:string;packaging?:string;dimensions?:string;notes?:string;hardPod?:boolean;paymentTerms?:string;body?:string;postedAt:string;status:"Open"|"Awarded"|"Cancelled";quote?:number;driver?:string;awardedQuoteId?:string;acceptanceStatus?:"Pending"|"Accepted"|"Rejected";acceptanceAt?:string;awardHistory?:{quoteId:string;role:string;amount:number;awardedAt:string;decision?:string;decisionAt?:string}[];assignedDriver?:string;assignedVehicleId?:string;deliveryStage?:number;podReceived?:boolean;podRecipient?:string;podPhotoCount?:number;podConfirmedAt?:string};
export type Quote={id:string;loadId:string;role:string;amount:number;vehicle?:string;etaMinutes?:number;notes?:string;createdAt:string;status:"Open"|"Withdrawn"};
type Data={loads:Load[];quotes:Quote[]};
const dir=join(process.cwd(),".local-tools","try-xdrive-demo");
const file=join(dir,"exchange.json");

function valid(v:unknown):v is Data{return !!v&&typeof v==="object"&&Array.isArray((v as Data).loads)&&Array.isArray((v as Data).quotes)}
export function readDemo():Data{mkdirSync(dir,{recursive:true});if(!existsSync(file)){const initial:Data={loads:[],quotes:[]};writeDemo(initial);return initial}try{const v:unknown=JSON.parse(readFileSync(file,"utf8"));if(valid(v))return v}catch{throw Error("Demo storage JSON invalid: refusing to overwrite")}throw Error("Demo storage unreadable: refusing to overwrite")}
export function writeDemo(data:Data){mkdirSync(dir,{recursive:true});const tmp=file+".tmp";writeFileSync(tmp,JSON.stringify(data,null,2),"utf8");renameSync(tmp,file)}
