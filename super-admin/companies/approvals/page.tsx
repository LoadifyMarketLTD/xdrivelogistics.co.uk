import { createClient } from '@supabase/supabase-js';
import { updateCompanyStatus } from './actions';

// Forțăm Next.js să nu cache-uiască această pagină static, pentru a citi mereu date proaspete din DB
export const revalidate = 0;

export default async function CompanyApprovalsPage() {
  // Inițializăm clientul Supabase pe Server Component folosind variabilele din proces
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Interogăm doar companiile care așteaptă aprobare (pending_approval) conform schemei tale live
  const { data: pendingCompanies, error } = await supabase
    .from('companies')
    .select('id, name, company_number, trading_name, created_at')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching company approvals:', error.message);
  }

  return (
    <div className="max-w-5xl mx-auto my-10 p-6 font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Company Approvals Gateway</h1>
        <p className="text-sm text-zinc-500">Review newly onboarded UK companies and verify their transport credentials.</p>
      </div>

      {!pendingCompanies || pendingCompanies.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-zinc-200 bg-white rounded-2xl">
          <p className="text-zinc-500 font-medium">No company registrations currently require platform review.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm text-left">
            <thead className="bg-zinc-50 font-semibold text-zinc-700">
              <tr>
                <th className="p-4">Company Profile</th>
                <th className="p-4">UK Comp House ID</th>
                <th className="p-4">Submission Date</th>
                <th className="p-4 text-right">Verification Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {pendingCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-zinc-900">{company.name}</div>
                    <div className="text-xs text-zinc-500">{company.trading_name || 'No trading name listed'}</div>
                  </td>
                  <td className="p-4 font-mono text-xs text-zinc-600">{company.company_number}</td>
                  <td className="p-4 text-zinc-600">
                    {new Date(company.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {/* Butonul de Reject */}
                    <form action={async () => {
                      'use server';
                      await updateCompanyStatus(company.id, 'rejected');
                    }} className="inline">
                      <button type="submit" className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer">
                        Reject
                      </button>
                    </form>
                    
                    {/* Butonul de Approve */}
                    <form action={async () => {
                      'use server';
                      await updateCompanyStatus(company.id, 'approved');
                    }} className="inline">
                      <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg transition-all duration-200 shadow-sm cursor-pointer">
                        Approve Company
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
