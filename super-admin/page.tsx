'use client';

import { useState } from 'react';
import { registerValidatedCompany } from '@/app/actions/companies'; // Corectat: Import absolut securizat conform structurii tale

export default function TestCompaniesApiPage() {
  const [companyNumber, setCompanyNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; companyId?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyNumber.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Sesiune de test cu ID complet inofensiv pentru rularea diagnosticelor
      const testUserId = '00000000-0000-0000-0000-000000000000';
      
      const res = await registerValidatedCompany(companyNumber.trim(), testUserId);
      setResult(res);
    } catch (err) {
      setResult({ success: false, error: 'An unexpected framework error occurred during testing.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm font-sans">
      <h1 className="text-xl font-bold text-zinc-900 mb-2">UK Companies House Verification Lab</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Test input execution against live UK government registries. Inputting a valid company number triggers an active lookup.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
            UK Company Number (8 digits)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value)}
              placeholder="e.g., 13171804"
              maxLength={8}
              className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-xl disabled:bg-zinc-400 transition"
            >
              {loading ? 'Querying...' : 'Run Diagnostics'}
            </button>
          </div>
        </div>
      </form>

      {result && (
        <div className={`mt-6 p-4 rounded-xl border text-sm ${
          result.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {result.success ? (
            <div>
              <p className="font-semibold">🟢 Verification Success!</p>
              <p className="mt-1 text-xs text-emerald-600 font-mono">Company registered in database under node ID: {result.companyId}</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold">🔴 Diagnostics Failed</p>
              <p className="mt-1 text-xs opacity-90">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
