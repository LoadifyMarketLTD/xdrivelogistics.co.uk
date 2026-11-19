export function safeOwnerDocumentUrl(value:unknown):string|null{
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname.endsWith('.supabase.co')&&!u.username&&!u.password&&u.pathname.startsWith('/storage/v1/object/sign/load-documents/')&&Boolean(u.searchParams.get('token'))?u.href:null;}catch{return null;}
}
