"use client";
import DemoCompanyBookings from "./DemoCompanyBookings";
import DemoSharedBookings from "./DemoSharedBookings";

/** Role-safe booking presentation: Company reference list, KPIs and filters;
 * the existing operational booking workflow remains available on each role.
 * No Post Load components or pages are used here.
 */
export default function DemoReferenceBookings({role,focus}:{role:string;focus?:{ref:string;seq:number}|null}){
 if(role==="Driver")return <div className="xd-reference-role-bookings xd-driver-bookings"><DemoCompanyBookings role={role} focus={focus}/></div>;
 return <div className="xd-reference-role-bookings">
  <DemoCompanyBookings role={role} focus={focus}/>
  <details className="xd-ref-booking-actions">
   <summary>Operational booking actions</summary>
   <DemoSharedBookings role={role}/>
  </details>
 </div>;
}
