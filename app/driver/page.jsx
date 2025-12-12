// app/driver/page.jsx
import Link from "next/link";

export const metadata = {
  title: "Jobs | XDrive Logistics",
  description: "Active jobs list for XDrive Logistics drivers",
};

const jobs = [
  {
    id: "job-1",
    date: "January 15, 2024",
    pickup: "Liverpool",
    delivery: "London",
    client: "DELVS",
    price: 250,
  },
  {
    id: "job-2",
    date: "January 14, 2024",
    pickup: "Glasgow",
    delivery: "Manchester",
    client: "DELIVS",
    price: 275,
  },
  {
    id: "job-3",
    date: "January 13, 2024",
    pickup: "Oxford",
    delivery: "Birmingham",
    client: "RATING",
    price: 200,
  },
];

export default function DriverJobsPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-md mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <button className="px-4 py-1 rounded-full bg-sky-500 text-sm font-medium">
            Active (3)
          </button>
        </div>
      </header>

      {/* JOB CARDS */}
      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={/driver/jobs/${job.id}}
            className="block rounded-2xl bg-white shadow-sm border border-slate-200 px-4 py-3"
          >
            <p className="text-xs text-slate-500 mb-1">{job.date}</p>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {job.pickup}
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {job.delivery}
                </p>
                <p className="mt-2 text-xs tracking-wide text-slate-400 uppercase">
                  {job.client}
                </p>
              </div>

              <div className="flex flex-col items-end">
                <p className="text-lg font-semibold text-slate-900">
                  £{job.price.toFixed(2)}
                </p>
                <span className="mt-2 inline-flex items-center text-xs text-sky-600">
                  View details <span className="ml-1">›</span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
