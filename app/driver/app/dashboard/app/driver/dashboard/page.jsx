export const metadata = {
  title: "Jobs | XDrive Logistics",
  description: "Active courier jobs available for drivers",
};

const jobs = [
  {
    id: "1",
    date: "January 15, 2024",
    from: "Liverpool",
    to: "London",
    price: "£250.00",
    type: "DELIVERY",
  },
  {
    id: "2",
    date: "January 14, 2024",
    from: "Glasgow",
    to: "Manchester",
    price: "£275.00",
    type: "DELIVERY",
  },
  {
    id: "3",
    date: "January 13, 2024",
    from: "Oxford",
    to: "Birmingham",
    price: "£200.00",
    type: "RATED",
  },
];

export default function JobsPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <span className="bg-blue-600 text-white text-sm font-semibold px-4 py-1 rounded-full">
            Active ({jobs.length})
          </span>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-2xl shadow-sm p-4 flex justify-between items-center hover:shadow-md transition"
            >
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-2">{job.date}</p>

                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center mt-1">
                    <span className="w-3 h-3 rounded-full bg-green-600" />
                    <span className="w-0.5 h-6 bg-gray-300" />
                    <span className="w-3 h-3 rounded-full bg-orange-500" />
                  </div>

                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {job.from}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {job.to}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                  <span className="uppercase tracking-wide">
                    {job.type}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="text-xl font-bold text-gray-900">
                  {job.price}
                </span>
                <span className="text-gray-400 text-xl">{">"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
