// app/driver/page.jsx
"use client";

import Link from "next/link";

const mockJobs = [
  {
    id: "1041-3387-LC",
    pickup: "Manchester",
    delivery: "Dover",
    amount: 250,
    date: "2025-01-15",
    status: "In transit",
  },
  {
    id: "4641-8508-LC",
    pickup: "Glasgow",
    delivery: "Oxford",
    amount: 275,
    date: "2025-01-14",
    status: "In transit",
  },
  {
    id: "4881-8550-LC",
    pickup: "Glasgow",
    delivery: "Dover",
    amount: 200,
    date: "2025-01-13",
    status: "Assigned",
  },
];

export default function DriverJobsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Jobs for today
            </h1>
            <p className="text-sm text-slate-400">
              Here are your current and upcoming loads.
            </p>
          </div>

          <div className="text-right text-xs text-slate-400">
            <div className="font-semibold text-slate-200">Daniel Preda</div>
            <div>Mercedes Sprinter LWB</div>
          </div>
        </header>

        <section className="space-y-4">
          {mockJobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between hover:border-brand/70 hover:bg-slate-900 transition"
            >
              <div>
                <div className="text-xs text-slate-400 mb-1">
                  {job.date} • Ref #{job.id}
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      {job.pickup}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Pickup
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">→</div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      {job.delivery}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Delivery
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                  {job.status}
                </span>
                <div className="text-sm font-semibold text-slate-100">
                  £{job.amount.toFixed(2)}
                </div>

                {/* AICI ERA PROBLEMA — acum este 100% corect */}
                <Link
                  href={/jobs/${job.id}}
                  className="text-xs font-semibold text-brand hover:text-brand/80 underline-offset-4 hover:underline"
                >
                  View
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
