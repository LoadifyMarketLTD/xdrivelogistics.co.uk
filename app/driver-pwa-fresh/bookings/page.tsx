import Link from 'next/link';
import {FreshHeader,FreshBottom} from '../FreshNavigation';
export default function Bookings(){return <><FreshHeader/><main className="fresh-content"><h1>Bookings</h1><p>Existing bookings remain available in the driver workspace.</p><Link className="fresh-detail" href="/driver/won-work">Open My Bookings</Link></main><FreshBottom active="bookings"/></>}
