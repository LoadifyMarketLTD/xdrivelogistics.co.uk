export const metadata = {
  title: 'Driver Dashboard | XDrive Logistics',
};

const activeJob = {
  id: '#29345',
  pickup: 'Glasgow',
  delivery: 'Newcastle',
  pickupTime: '15/12/2023 14:00',
  deliveryTime: '15/12/2023 18:30',
};

const activeJobs = [
  { id: '#29345', pickup: 'Glasgow', delivery: 'Newcastle' },
  { id: '#29304', pickup: 'Glasgow', delivery: 'Liverpool' },
  { id: '#29287', pickup: 'Manchester', delivery: 'Edinburgh' },
  { id: '#29256', pickup: 'Birmingham', delivery: 'Derby' },
  { id: '#29236', pickup: 'York', delivery: 'Inverness' },
];

const history = [
  { id: '#29110', pickup: 'Leeds', delivery: 'London', completed: '10/12/2023' },
  { id: '#29087', pickup: 'Bristol', delivery: 'Cardiff', completed: '08/12/2023' },
];

export default function DriverPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm">
        {/* Header simplu */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            Driver Dashboard
          </h1>
          <nav className="hidden gap-4 text-sm text-slate-600 sm:flex">
            <a href="/dashboard" className="hover:text-slate-900">Dashboard</a>
            <a href="/jobs" className="hover:text-slate-900">Jobs</a>
            <a href="/tracking/REF1006" className="hover:text-slate-900">
              Tracking
            </a>
          </nav>
        </header>

        <div className="grid gap-6 md:grid-cols-[260px,1fr]">
          {/* Profil driver */}
          <section className="space-y-4 rounded-2xl bg-slate-50 p-5">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 h-24 w-24 overflow-hidden rounded-full bg-slate-200">
                {/* Placeholder foto – mai târziu pui poza ta */}
                <div className="flex h-full w-full items-center justify-center text-3xl text-slate-500">
                  DP
                </div>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                Daniel Preda
              </h2>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                Driver
              </p>
              <button className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">
                Go Offline
              </button>
            </div>

            <dl className="space-y-2 text-sm text-slate-700">
              <InfoRow label="Email Address" value="danie@example.com" />
              <InfoRow label="Phone Number" value="+44 7123 45789" />
              <InfoRow label="Vehicle" value="Mercedes Sprinter LWB" />
              <InfoRow label="Registration" value="SF19 WZC" />
              <InfoRow label="Rating" value="★★★★★" />
              <InfoRow label="Verification" value="ID + Full Insurance" />
            </dl>
          </section>

          {/* Dreapta: Active job + history */}
          <section className="space-y-6">
            {/* Active job mare în stânga sus (ca în cardul original) */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Active Job
                </h3>
                <div className="text-sm text-slate-800">
                  <div className="text-sky-600 underline">{activeJob.id}</div>
                  <div className="mt-1 font-medium">{activeJob.pickup}</div>
                  <div className="text-xs text-slate-500">
                    {activeJob.pickupTime}
                  </div>
                  <div className="mt-2 font-medium">{activeJob.delivery}</div>
                  <div className="text-xs text-slate-500">
                    {activeJob.deliveryTime}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Active Jobs
                </h3>
                <div className="space-y-2 text-sm text-slate-800">
                  {activeJobs.map(job => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-xs"
                    >
                      <div>
                        <div className="text-sky-600 underline">{job.id}</div>
                        <div className="text-xs text-slate-500">
                          {job.pickup} → {job.delivery}
                        </div>
                      </div>
                      <a
                        href={/jobs/${job.id.replace('#', '')}}
                        className="text-xs font-semibold text-brand"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Job history */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Job History
              </h3>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Job</Th>
                      <Th>Pickup</Th>
                      <Th>Delivery</Th>
                      <Th>Completed</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {history.map(job => (
                      <tr key={job.id}>
                        <Td>{job.id}</Td>
                        <Td>{job.pickup}</Td>
                        <Td>{job.delivery}</Td>
                        <Td>{job.completed}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-right text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="px-3 py-2 text-sm text-slate-800">{children}</td>
  );
}
