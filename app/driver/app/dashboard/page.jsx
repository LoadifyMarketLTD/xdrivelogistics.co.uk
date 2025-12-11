export const metadata = {
  title: 'Dashboard | XDrive Logistics',
};

const recentJobs = [
  { ref: '1041-3387-LC', pickup: 'Manchester', delivery: 'Dover', status: 'In Transit' },
  { ref: '4641-8508-LC', pickup: 'Glasgow', delivery: 'Oxford', status: 'In Transit' },
  { ref: '4881-8550-LC', pickup: 'Glasgow', delivery: 'Dover', status: 'In Transit' },
  { ref: '1423-0883-LT', pickup: 'Molden', delivery: 'Surrey', status: 'In Transit' },
  { ref: '4641-3508-LC', pickup: 'Newcastle', delivery: 'Chesham', status: 'In Transit' },
];

const recentRegs = [
  { name: 'Emma Hughes', date: '2024-01-19' },
  { name: 'Daniel Foster', date: '2024-01-20' },
  { name: 'Sophia Knight', date: '2024-01-20' },
  { name: 'James Palmer', date: '2024-01-18' },
  { name: "Debbie O'Connor", date: '2024-01-18' },
];

const vehicles = [
  { driver: 'Alex Stone', vehicle: 'Ford Transit', reg: 'YO13 FGD', status: 'Available' },
  { driver: 'Rachel Murray', vehicle: 'Mercedes Sprinter', reg: 'RS68 MTA', status: 'Available' },
  { driver: 'Daniel Blake', vehicle: 'Peugeot Boxer', reg: 'FR00 BNE', status: 'Available' },
  { driver: 'Laura Simpson', vehicle: 'VW Crafter', reg: 'DD16 XCX', status: 'Available' },
  { driver: 'George Kerr', vehicle: 'VW Crafter', reg: 'AK69 HVD', status: 'Available' },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <span className="text-sm text-slate-500">XDrive Logistics overview</span>
        </header>

        {/* Cards de statistici */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Total Jobs" value="27" className="bg-emerald-500" />
          <StatCard label="Vehicles" value="8" className="bg-blue-500" />
          <StatCard label="Customers" value="14" className="bg-amber-500" />
          <StatCard label="Users" value="3" className="bg-red-500" />
        </div>

        {/* Tabele */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Recent Jobs
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Ref</Th>
                    <Th>Pickup</Th>
                    <Th>Delivery</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentJobs.map(job => (
                    <tr key={job.ref}>
                      <Td>{job.ref}</Td>
                      <Td>{job.pickup}</Td>
                      <Td>{job.delivery}</Td>
                      <Td>
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {job.status}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Recent Registrations
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Name</Th>
                    <Th>Signed Up</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentRegs.map(item => (
                    <tr key={item.name}>
                      <Td>{item.name}</Td>
                      <Td>{item.date}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-6 mb-3 text-base font-semibold text-slate-900">
              Vehicles
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Driver</Th>
                    <Th>Vehicle</Th>
                    <Th>Reg. Number</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {vehicles.map(v => (
                    <tr key={v.reg}>
                      <Td>{v.driver}</Td>
                      <Td>{v.vehicle}</Td>
                      <Td>{v.reg}</Td>
                      <Td>
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {v.status}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, className }) {
  return (
    <div
      className={rounded-2xl px-4 py-4 text-white shadow-sm ${className}}
    >
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
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
    <td className="px-3 py-2 text-sm text-slate-800">
      {children}
    </td>
  );
}
