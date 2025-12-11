// app/driver/app/dashboard/page.jsx
"use client";

const stats = [
  { label: "Total Jobs", value: 27 },
  { label: "Vehicles", value: 8 },
  { label: "Customers", value: 14 },
  { label: "Users", value: 3 },
];

const recentJobs = [
  { ref: "1041-3387-LC", pickup: "Manchester", delivery: "Dover", status: "In transit" },
  { ref: "4641-8508-LC", pickup: "Glasgow", delivery: "Oxford", status: "In transit" },
  { ref: "4881-8550-LC", pickup: "Glasgow", delivery: "Dover", status: "In transit" },
  { ref: "1423-0883-LT", pickup: "Molden", delivery: "Surrey", status: "In transit" },
];

const recentRegistrations = [
  { name: "Emma Hughes", date: "2024-01-19" },
  { name: "Daniel Foster", date: "2024-01-20" },
  { name: "Sophia Knight", date: "2024-01-20" },
  { name: "James Palmer", date: "2024-01-18" },
  { name: "Debbie O'Connor", date: "2024-01-18" },
];

const vehicles = [
  { driver: "Alex Stone", vehicle: "Ford Transit", reg: "Y013 FGD", status: "Available" },
  { driver: "Rachel Murray", vehicle: "Mercedes Sprinter", reg: "RS68 MTA", status: "Available" },
  { driver: "Daniel Blake", vehicle: "Peugeot Boxer", reg: "FR00 BNE", status: "In transit" },
  { driver: "Laura Simpson", vehicle: "VW Crafter", reg: "DD16 XCX", status: "Available" },
];

export default function DriverDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            XDrive Logistics – Driver Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Overview of today&apos;s activity: jobs, vehicles and recent registrations.
          </p>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 flex flex-col justify-between"
            >
              <div className="text-xs text-slate-400">{item.label}</div>
              <div className="text-2xl font-semibold mt-1">{item.value}</div>
            </div>
          ))}
        </section>

        {/* Two-column layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Jobs */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Jobs</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-2">Ref</th>
                    <th className="py-2 pr-2">Pickup</th>
                    <th className="py-2 pr-2">Delivery</th>
                    <th className="py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.ref} className="border-b border-slate-900">
                      <td className="py-2 pr-2 text-slate-200">{job.ref}</td>
                      <td className="py-2 pr-2">{job.pickup}</td>
                      <td className="py-2 pr-2">{job.delivery}</td>
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Registrations */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Registrations</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Signed up</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRegistrations.map((user) => (
                    <tr key={user.name} className="border-b border-slate-900">
                      <td className="py-2 pr-2 text-slate-200">{user.name}</td>
                      <td className="py-2 pr-2">{user.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Vehicles */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="text-sm font-semibold mb-3">Vehicles</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 pr-2">Driver</th>
                  <th className="py-2 pr-2">Vehicle</th>
                  <th className="py-2 pr-2">Reg. Number</th>
                  <th className="py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.reg} className="border-b border-slate-900">
                    <td className="py-2 pr-2 text-slate-200">{v.driver}</td>
                    <td className="py-2 pr-2">{v.vehicle}</td>
                    <td className="py-2 pr-2">{v.reg}</td>
                    <td className="py-2 pr-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
