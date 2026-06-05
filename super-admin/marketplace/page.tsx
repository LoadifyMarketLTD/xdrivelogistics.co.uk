import { createClient } from '@supabase/supabase-js';

// Forțăm Next.js să citească mereu date proaspete din bursă (Live Exchange data)
export const revalidate = 0;

export default async function OpenLoadBoardPage() {
  // Inițializăm clientul administrativ pentru a citi datele globale din bursă
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Interogăm joburile scoase la bursa publică conform structurii tale reale ('true' ca text)
  const { data: exchangeJobs, error } = await supabase
    .from('jobs')
    .select('id, name, company_id, status, job_distance_miles, created_at')
    .eq('exchange_visibility', 'true')
    .eq('status', 'posted')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error hydrating Open Load Board streaming:', error.message);
  }

  return (
    <div className="max-w-6xl mx-auto my-10 p-6 font-sans">
      
      {/* Header Platformă Mamă */}
      <div className="mb-8 border-b border-zinc-200 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">XDrive Open Load Board</h1>
          <p className="text-sm text-zinc-500 mt-1">SaaS Marketplace Central Hub — Real-time peer-to-peer transport exchange streams.</p>
        </div>
        <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-full text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Network Stream
        </div>
      </div>

      {/* Verificare Listă Mărfuri */}
      {!exchangeJobs || exchangeJobs.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-zinc-200 bg-white rounded-3xl shadow-sm">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-zinc-900 font-bold text-lg">Bursa de transport este momentan goală</p>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto mt-1">
            În acest moment nu există mărfuri publice active postate de companii externe pe Platforma Mamă.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {exchangeJobs.map((job) => (
            <div key={job.id} className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm hover:border-zinc-300 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              
              {/* Detalii Cursă */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-zinc-900 text-white rounded-md font-mono text-xs font-bold uppercase tracking-wider">
                    LOAD
                  </span>
                  <h3 className="font-bold text-zinc-950 text-base">{job.name}</h3>
                </div>
                <div className="text-xs text-zinc-400 mt-1 flex items-center gap-3">
                  <span>Postat la: {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                  <span>•</span>
                  <span>ID Companie: {job.company_id.substring(0, 8)}...</span>
                </div>
              </div>

              {/* Distanță și Control Licitație */}
              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100">
                <div className="text-right">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Distance</div>
                  <div className="text-lg font-black text-zinc-900 mt-0.5">
                    {job.job_distance_miles ? `${job.job_distance_miles} mi` : '—'}
                  </div>
                </div>
                <button className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer">
                  Vizualizează Oferte
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
