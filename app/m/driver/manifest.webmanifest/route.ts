import { NextResponse } from 'next/server';
export function GET() {
 return NextResponse.json({name:'XDrive Driver',short_name:'XDrive Driver',description:'XDrive Driver mobile operations',start_url:'/m/driver/jobs',scope:'/m/driver/',display:'standalone',orientation:'portrait-primary',background_color:'#f7f9fc',theme_color:'#0b4289',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]}, {headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-cache'}});
}
