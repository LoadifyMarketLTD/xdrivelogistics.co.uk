"use client";
import { useState, useEffect } from "react";

export default function DriverPage() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    async function loadJobs() {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data);
    }
    loadJobs();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Active Jobs</h1>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-slate-600">
            <th className="py-2 px-4">Job</th>
            <th className="py-2 px-4">Pickup</th>
            <th className="py-2 px-4">Delivery</th>
            <th className="py-2 px-4">Status</th>
            <th className="py-2 px-4">Action</th>
          </tr>
        </thead>

        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b hover:bg-slate-50 transition"
            >
              <td className="py-2 px-4">{job.id}</td>
              <td className="py-2 px-4">{job.pickup}</td>
              <td className="py-2 px-4">{job.delivery}</td>
              <td className="py-2 px-4">{job.status}</td>
              <td className="py-2 px-4">
                <a
                  href={/jobs/${job.id}}
                  className="text-blue-600 font-semibold"
                >
                  View
                </a>
              </td>
            </tr>
          ))}

        </tbody>
      </table>
    </div>
  );
}
