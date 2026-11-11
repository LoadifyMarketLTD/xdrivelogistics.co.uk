'use client';

import DemoExchangeBoard from '../../try-xdrive-demo/components/DemoExchangeBoard';
import { Company3150LiveProvider } from '../../try-xdrive-demo/components/Company3150LiveData';
import '../../components/workspace/canonical3150-customer-load-details.css';

/** Original approved 3150 Loads page, now driven by authenticated and RLS-scoped company data. */
export default function Page() {
  return <Company3150LiveProvider publicLocations>
    <div className="master3150-production">
      <DemoExchangeBoard role="Customer" productionMode />
    </div>
  </Company3150LiveProvider>;
}