"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('driver');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role, // Store role in user metadata
          },
        },
      });

      if (error) throw error;

      // Redirect to login or dashboard
      router.push('/login');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">

      {/* 70% LEFT PANEL - VIDEO / HERO SECTION */}
      <div className="hidden lg:flex flex-1 flex-col justify-between border-r border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">

        {/* HEADER */}
        <header className="px-10 pt-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-xs font-semibold tracking-wide">
            XDL
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-slate-400">
              XDrive Logistics
            </div>
            <div className="text-xs text-slate-500">by Danny Courier LTD</div>
          </div>
        </header>

        {/* MAIN HERO */}
        <main className="px-10 pb-16">

          {/* VIDEO / SLIDESHOW placeholder */}
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="aspect-[16/9] w-full bg-gradient-to-tr from-indigo-500/40 via-emerald-400/20 to-sky-500/40" />
          </div>

          {/* 3 COLUMN INFO */}
          <div className="grid gap-6 text-sm text-slate-200 md:grid-cols-3">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">For drivers</h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Search loads by radius</li>
                <li>• Profit per mile calculator</li>
                <li>• Save favourite routes</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">For operators</h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Assign loads instantly</li>
                <li>• Multi-vehicle planner</li>
                <li>• POD & invoices</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Live insights</h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Heatmap zones</li>
                <li>• Busy postcodes</li>
                <li>• Daily revenue snapshot</li>
              </ul>
            </div>
          </div>
        </main>
      </div>

      {/* RIGHT REGISTER PANEL */}
      <div className="w-full lg:max-w-md bg-slate-950 flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          
          <h1 className="text-xl font-semibold tracking-tight text-slate-50 mb-2">
            Create your account
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            Join XDrive Logistics as a driver or shipper.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* REGISTER FORM */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">Email</label>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">Password</label>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-slate-500">Minimum 6 characters</p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">Account Type</label>
              <select
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="driver">Driver</option>
                <option value="shipper">Shipper / Operator</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-500 hover:text-emerald-400">
              Log in here
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
