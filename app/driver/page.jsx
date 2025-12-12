export default function DriverDashboardPage() {
  const activeJobs = [
    { id: "#29345", pickup: "Glasgow", delivery: "Newcastle" },
    { id: "#29304", pickup: "Liverpool", delivery: "Glasgow" },
    { id: "#29287", pickup: "Manchester", delivery: "Edinburgh" },
    { id: "#29256", pickup: "Birmingham", delivery: "Derby" },
    { id: "#29236", pickup: "York", delivery: "Inverness" },
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="font-bold text-xl text-slate-900">XDRIVE</div>
            <span className="text-slate-500 text-sm">Logistics</span>
          </div>
          <nav className="flex items-center gap-8 text-sm text-slate-600">
            <button className="font-medium text-slate-900">Dashboard</button>
            <button>Jobs</button>
            <button>Tracking</button>
            <button>Drivers</button>
            <button className="flex items-center gap-2">
              <span>Admin</span>
            </button>
          </nav>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          {/* Card șofer */}
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-full bg-slate-200 overflow-hidden mb-3">
                {/* aici poți pune poza ta reală */}
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                Daniel Preda
              </h2>
              <button className="mt-3 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg font-medium">
                Go Offline
              </button>
            </div>
          </section>

          {/* Info + Active Jobs */}
          <section className="space-y-6">
            {/* Info driver */}
            <div className="bg-white rounded-2xl shadow-sm p-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="text-slate-500">Email Address</p>
                <p className="font-medium text-slate-900">
                  daniel@example.com
                </p>
                <p className="text-slate-500 mt-4">Vehicle</p>
                <p className="font-medium text-slate-900">
                  Mercedes Sprinter LWB
                </p>
                <p className="text-slate-500 mt-4">Registration</p>
                <p className="font-medium text-slate-900">SF19 WZC</p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-slate-500">Phone Number</p>
                <p className="font-medium text-slate-900">+44 7123 45789</p>
                <p className="text-slate-500 mt-4">Rating</p>
                <p className="font-medium text-amber-500 text-lg">
                  ★★★★★
                </p>
                <p className="text-slate-500 mt-4">Verification</p>
                <p className="font-medium text-slate-900">
                  ID + Full Insurance
                </p>
              </div>
            </div>

            {/* Active Job + tabel */}
            <div className="grid gap-6 md:grid-cols-[260px,1fr]">
              <div className="bg-white rounded-2xl shadow-sm p-6 text-sm">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Active Job
                </h3>
                <p className="text-sky-600 font-medium mb-1">#29345</p>
                <p className="text-slate-900 mb-1">Glasgow</p>
                <p className="text-slate-500 text-xs mb-4">
                  15/12/2023 14:00
                </p>
                <p className="text-slate-900 mb-1">Newcastle</p>
                <p className="text-slate-500 text-xs">
                  15/12/2023 18:30
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6 text-sm">
                <h3 className="font-semibold text-slate-900 mb-3">
                  Active Job
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs md:text-sm">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="py-1 pr-4">Job</th>
                        <th className="py-1 pr-4">Pickup</
