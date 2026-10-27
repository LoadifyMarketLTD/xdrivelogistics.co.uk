import DemoQuoteForm from './DemoQuoteForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
const samples: Record<string,{from:string;to:string;vehicle:string}> = {
 'visual-1':{from:'ERITH DA8',to:'BLACKBURN BB1',vehicle:'LWB Van'},
 'visual-2':{from:'BLACKBURN BB1',to:'ERITH DA8',vehicle:'LWB Van'},
 'visual-3':{from:'LONDON SE1',to:'LUTON LU1',vehicle:'LWB Van'}
};
export default async function QuoteVisualPreview({searchParams}:{searchParams:Promise<{load?:string}>}){
 const host=(await headers()).get('host')??'';
 if(process.env.NODE_ENV!=='development'&&!/^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host))notFound();
 const {load}=await searchParams;const item=samples[load||''];if(!item)notFound();
 return <>
 <header className="fresh-header fresh-preview-details-header"><Link className="fresh-back" href={`/driver-pwa-fresh/visual-preview/details?load=${encodeURIComponent(load||'')}`}>‹</Link><h1>Quote Now</h1><span>£</span></header>
 <main className="fresh-content fresh-preview-quote">
 <section className="fresh-quote-job"><strong>XDRIVE LOGISTICS LTD</strong><p><b style={{color:'#ec5a51'}}>HOTSHOT</b> · {item.vehicle}</p><p style={{color:'#388c45',fontWeight:700}}>SmartPay Enabled</p><div className="fresh-quote-route"><strong>{item.from}</strong><small>Collection</small><strong>{item.to}</strong><small>Delivery</small></div><p>Distance: Not available for sample</p></section>
 <section className="fresh-quote-panel"><label>Will Pick Up Within<select defaultValue=""><option value="">Not supplied</option><option>15 minutes</option><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option><option>90 minutes</option><option>120 minutes</option></select></label><label>Vehicle<input readOnly value={item.vehicle}/></label></section>
 <section className="fresh-quote-panel"><label>Choose currency<select defaultValue="GBP"><option>GBP</option></select></label><div className="fresh-quote-extras">Extras <button disabled type="button">+ ADD NEW</button></div></section>
 <section className="fresh-quote-panel"><label>Notes<textarea rows={5} placeholder="Message to customer"/></label></section>
 <DemoQuoteForm/><p><Link href="/driver-pwa-fresh/jobs">Open live Jobs</Link></p>
 </main><nav className="fresh-bottom" aria-label="Driver tabs"><Link className="selected" href="/driver-pwa-fresh/visual-preview">Jobs</Link><span aria-disabled="true">Quotes</span><span aria-disabled="true">Bookings</span><span aria-disabled="true">More</span></nav>
 </>;
}
