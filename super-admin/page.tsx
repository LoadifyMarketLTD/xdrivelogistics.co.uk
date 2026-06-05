import { createClient } from '@/utils/supabase/server'; // Adaptați calea dacă structura proiectului cere alt import
import { ProtectedRoute } from '@/app/components/ProtectedRoute';

export default async function SuperAdminDashboardRootPage() {
  // Inițializăm instanța securizată de Supabase pe server
  const supabase = await createClient();

  // Executăm interogările globale în paralel pentru performanță optimă (Logica migrată din /platform)
  const [companiesRes, driversRes, jobsRes] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('drivers').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('id', { count: 'exact', head: true })
  ]);

  const totalCompanies = companiesRes.count || 0;
  const totalDrivers = driversRes.count || 0;
  const totalJobs = jobsRes.count || 0;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-6xl mx-auto my-10 p-6 font-sans">
        
        {/* Header Consolă */}
        <div className="mb-8 border-b border-zinc-200 pb-5">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Global Platform Administration</h1>
          <p className="text-sm text-zinc-500 mt-1">Operational infrastructure management and exchange governance for XDrive Logistics.</p>
        </div>

        {/* Live KPI Grid (Cifrele vii înlocuiesc liniuțele) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm transition-all hover:border-zinc-300">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Registered Companies</div>
            <div className="text-4xl font-black text-zinc-900 mt-2">{totalCompanies}</div>
            <div className="text-xs text-emerald-600 font-medium mt-1">✓ Fleet networks active</div>
          </div>

          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm transition-all hover:border-zinc-300">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Verified Drivers</div>
            <div className="text-4xl font-black text-zinc-900 mt-2">{totalDrivers}</div>
            <div className="text-xs text-emerald-600 font-medium mt-1">✓ Drivers online nearby</div>
          </div>

          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm transition-all hover:border-zinc-300">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Live Exchange Loads</div>
            <div className="text-4xl font-black text-zinc-900 mt-2">{totalJobs}</div>
            <div className="text-xs text-zinc-500 font-medium mt-1">• Active tracking streams</div>
          </div>

        </div>

        {/* Indicator de Stare a Infrastructurii */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-zinc-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Platform available · operations support active</span>
          </div>
          <div className="text-xs text-zinc-400 font-mono">XDRV-CORE-v2.6</div>
        </div>

      </div>
    </ProtectedRoute>
  );
}
