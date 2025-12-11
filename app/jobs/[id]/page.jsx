export const metadata = {
  title: 'Job Details | XDrive Logistics',
};

const mockJob = {
  ref: 'ABC123',
  driver: 'Daniel Preda',
  vehicle: 'Mercedes Sprinter LWB',
  reg: 'SF19 WZC',
  customer: 'DHL Cargo',
  badge: 'XDL-001',
  rating: 5,
  pickupAddress: '31 Example St, London SW1A 1AA',
  pickupTime: 'Today, 13:00',
  deliveryAddress: '42 Sample Ave, Manchester M1 2AB',
  deliveryTime: 'Today, 18:00',
  price: 150,
  status: 'In transit',
};

export default function JobDetailPage({ params }) {
  const id = params.id?.toUpperCase() || mockJob.ref;
  const job = { ...mockJob, ref: id };

  return (
    <div className="flex min-h-screen justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-md">
        {/* Header albastru */}
        <header className="rounded-t-3xl bg-[#0A2239] px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="font-semibold tracking-widest">XDRIVE LOGISTICS</div>
            <div className="flex items-center gap-3 text-lg">
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                +
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                ☰
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-4 px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">JOB</h1>
          <div className="text-xs text-slate-500">
            Ref #: <span className="font-semibold">{job.ref}</span>
          </div>

          {/* Card principal cu șoferul */}
          <section className="rounded-2xl bg-slate-50 p-4">
            <div className="flex gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-200">
                {/* Placeholder poză */}
                <div className="flex h-full w-full items-center justify-center text-lg text-slate-500">
                  DP
                </div>
              </div>
              <div className="flex-1 text-sm">
                <div className="font-semibold text-slate-900">
                  {job.driver}
                </div>
                <div className="text-slate-600">{job.vehicle}</div>
                <div className="text-xs text-slate-500">{job.reg}</div>
                <div className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold">{job.customer}</span>
                  <span className="ml-1 text-[11px] text-slate-500">
                    (ID + Full Insurance Verified)
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Offer <span className="font-semibold">{job.badge}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 text-sm">
              <div className="rounded-lg bg-slate-200 px-3 py-1 text-center text-xs font-medium text-slate-700">
                {job.status}
              </div>
            </div>
          </section>

          {/* Pickup / Delivery */}
          <section className="space-y-3 text-sm text-slate-800">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">
                PICKUP
              </div>
              <div className="font-medium">{job.pickupAddress}</div>
              <div className="text-xs text-slate-500">{job.pickupTime}</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">
                DELIVERY
              </div>
              <div className="font-medium">{job.deliveryAddress}</div>
              <div className="text-xs text-slate-500">{job.deliveryTime}</div>
            </div>
          </section>

          {/* Preț */}
          <button className="mt-2 w-full rounded-xl bg-[#0A2239] px-4 py-2.5 text-center text-sm font-semibold text-white">
            £{job.price.toFixed(2)}
          </button>
        </main>
      </div>
    </div>
  );
}
