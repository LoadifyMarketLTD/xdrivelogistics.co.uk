import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";
import {getBearerToken} from "../_lib/supabaseAdmin";
import {isAuthorizedDemoStagingUrl} from "../../../lib/try-xdrive-demo/stagingProject";

const deny=(status:number,error:string)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
export type DemoMember={userId:string;memberId:string;role:string;db:SupabaseClient};
/** Per-request JWT-scoped client. Never use service-role privileges for DEMO data access. */
export async function requireDemoMember(request:NextRequest):Promise<DemoMember|NextResponse>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()||process.env.SUPABASE_URL?.trim();
 const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()||process.env.SUPABASE_ANON_KEY?.trim();
 if(!isAuthorizedDemoStagingUrl(url)||!anonKey)return deny(503,"Dedicated staging configuration unavailable");
 const token=getBearerToken(request);
 if(!token)return deny(401,"Authentication required");
 const db=createClient(url!,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return deny(401,"Invalid or expired session");
 const {data:profile,error:profileError}=await db.from("profiles").select("company_id,status").eq("user_id",auth.user.id).maybeSingle();
 if(profileError)return deny(503,"Membership verification unavailable");
 if(!profile||String(profile.status).toLowerCase()!=="active"||!profile.company_id)return deny(403,"Active company profile required");
 const {data:membership,error:membershipError}=await db.from("company_memberships").select("role_in_company,status").eq("user_id",auth.user.id).eq("company_id",profile.company_id).eq("status","active").maybeSingle();
 if(membershipError)return deny(503,"Membership verification unavailable");
 if(!membership)return deny(403,"Active company membership required");
 return {userId:auth.user.id,memberId:String(profile.company_id),role:String(membership.role_in_company),db};
}
