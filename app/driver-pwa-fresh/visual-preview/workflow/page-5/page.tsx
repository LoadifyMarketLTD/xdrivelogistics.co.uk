'use client';

import BookingRouteMap from '../../../BookingRouteMap';
import InTransitDeliveryStep from '../../../bookings/[id]/workflow/InTransitDeliveryStep';
import { FreshBottom } from '../../../FreshNavigation';

export default function InTransitDeliveryPreviewPage(){
 return <main className="fresh-driver-pwa">
  <InTransitDeliveryStep
   bookingReference="XDL-2026-00128" routeLabel="Blackburn BB1 → Manchester M2" agreedRate="£240.00" paymentTerms="30 Days EOM"
   map={<BookingRouteMap pickup="BB1 2BB" delivery="M2 2AB" focus="delivery"/>}
   routeMetrics={{distanceMiles:26.4,durationMinutes:46,recordedAt:new Date().toISOString(),origin:{lat:53.7486,lng:-2.4875},destination:{lat:53.4808,lng:-2.2426},geometry:[{"lat":53.748447,"lng":-2.488007},{"lat":53.743947,"lng":-2.482309},{"lat":53.73731,"lng":-2.469447},{"lat":53.734166,"lng":-2.458719},{"lat":53.729822,"lng":-2.451577},{"lat":53.725778,"lng":-2.446014},{"lat":53.719256,"lng":-2.426253},{"lat":53.713465,"lng":-2.409328},{"lat":53.703934,"lng":-2.376594},{"lat":53.700932,"lng":-2.349433},{"lat":53.693645,"lng":-2.318942},{"lat":53.682301,"lng":-2.306446},{"lat":53.660233,"lng":-2.307591},{"lat":53.623791,"lng":-2.287388},{"lat":53.586847,"lng":-2.272953},{"lat":53.549871,"lng":-2.259176},{"lat":53.537857,"lng":-2.288362},{"lat":53.531243,"lng":-2.283769},{"lat":53.522129,"lng":-2.274805},{"lat":53.510912,"lng":-2.263197},{"lat":53.503261,"lng":-2.258898},{"lat":53.495992,"lng":-2.259347},{"lat":53.488679,"lng":-2.257181},{"lat":53.483397,"lng":-2.254952},{"lat":53.480165,"lng":-2.245166},{"lat":53.480795,"lng":-2.242556}]}}
   address="Industrial Estate, Manchester M2 2AB" schedule="28 Oct · ASAP" contactName="Sarah Brown" phone="+44 7700 112233"
   instructions="Deliver to reception. Obtain signature." navigateHref="https://www.google.com/maps/search/?api=1&query=Manchester%20M2%202AB"
   onBack={()=>history.back()} onNext={()=>undefined}
  />
  <FreshBottom active="bookings" demo />
 </main>;
}
