import "server-only";
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from "node:fs";
import {join} from "node:path";
export type FleetVehicle={id:string;reg:string;vehicle:string;driver:string;status:string;location:string};
export type FleetState={vehicles:FleetVehicle[];drivers:string[]};
const directory=join(process.cwd(),".local-tools","try-xdrive-demo");
const file=join(directory,"fleet.json");
const initial:FleetState={vehicles:[{id:"XD-V101",reg:"DX26 VAN",vehicle:"Luton Van · Tail-lift",driver:"Alex Carter",status:"Available",location:"Birmingham B6"},{id:"XD-V102",reg:"DX25 LTN",vehicle:"Luton Van",driver:"Jamie Taylor",status:"On Job",location:"Coventry CV1"},{id:"XD-V103",reg:"DX24 LWB",vehicle:"Large Van",driver:"Morgan Lee",status:"Available",location:"Leicester LE1"}],drivers:["Alex Carter","Jamie Taylor","Morgan Lee"]};
export function readFleet():FleetState{mkdirSync(directory,{recursive:true});if(!existsSync(file)){writeFleet(initial);return initial}const value:unknown=JSON.parse(readFileSync(file,"utf8"));if(!validFleet(value))throw Error("Invalid demo fleet data; refusing overwrite");return value}
export function validFleet(v:unknown):v is FleetState{if(!v||typeof v!=="object")return false;const d=v as FleetState;return Array.isArray(d.drivers)&&d.drivers.length<500&&d.drivers.every(x=>typeof x==="string"&&x.length<=120)&&Array.isArray(d.vehicles)&&d.vehicles.length<500&&d.vehicles.every(x=>x&&["id","reg","vehicle","driver","status","location"].every(k=>typeof x[k as keyof FleetVehicle]==="string"&&x[k as keyof FleetVehicle].length<=200))}
export function writeFleet(value:FleetState){if(!validFleet(value))throw Error("Invalid fleet");mkdirSync(directory,{recursive:true});const tmp=file+".tmp";writeFileSync(tmp,JSON.stringify(value,null,2));renameSync(tmp,file)}
