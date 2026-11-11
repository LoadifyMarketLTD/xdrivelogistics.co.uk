"use client";
import {useState} from "react";
import {getSupabase} from "../../../lib/supabaseClient";
import {isAuthorizedXDriveProductionUrl} from "../../../lib/try-xdrive-demo/productionProject";
export default function DemoStagingSignIn(){
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const signIn=async()=>{
  setBusy(true);setMessage("");
  try{
   if(!isAuthorizedXDriveProductionUrl(process.env.NEXT_PUBLIC_SUPABASE_URL))throw new Error("XDrive production Supabase is not configured");
   const db=getSupabase();
   if(!db)throw new Error("XDrive authentication unavailable");
   const {error}=await db.auth.signInWithPassword({email:email.trim(),password});
   if(error)throw new Error(error.message);
   setPassword("");
   window.dispatchEvent(new Event("xdrive-demo-session-change"));
  }catch(e){setMessage(e instanceof Error?e.message:"Sign in failed")}
  finally{setBusy(false)}
 };
 return <form className="form-grid" onSubmit={e=>{e.preventDefault();void signIn()}}>
  <label>XDrive account email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <button className="primary" type="submit" disabled={busy}>{busy?"Signing in...":"Sign in to XDrive"}</button>
  {message&&<p role="alert">{message}</p>}
 </form>;
}
