'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export default function FreshSectionTabs({active='available',mapHref,filterHref}:{active?:'available'|'map'|'filter';mapHref?:string;filterHref?:string}){
 const path=usePathname();
 const root='/driver-pwa-fresh/jobs';
 const map=mapHref||root+'?view=map';
 const filter=filterHref||root+'?view=filter';
 return <nav className="fresh-tabs" aria-label="Available, Map and Filter">
 <Link className={active==='available'?'active':''} href={path.startsWith('/driver-pwa-fresh/visual-preview')?'/driver-pwa-fresh/visual-preview':root}>Available</Link>
 <Link className={active==='map'?'active':''} href={map}>Map</Link>
 <Link className={active==='filter'?'active':''} href={filter}>Filter</Link>
 </nav>;
}
