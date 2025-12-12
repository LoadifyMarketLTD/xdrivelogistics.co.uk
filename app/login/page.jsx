"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState('driver');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Redirect to dashboard after successful login
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
      // Redirect to dashboard on success
      router.push('/dashboard');
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

      {/* RIGHT LOGIN PANEL */}
      <div className="w-full lg:max-w-md bg-slate-950 flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          
          <h1 className="text-xl font-semibold tracking-tight text-slate-50 mb-2">
            Log in to your account
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            Enter your details to access loads, routes, profit dashboard and invoices.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                {error}
              </div>
            )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">Email</label>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                type="email"
                placeholder="driver@xdrive.co.uk"
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
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              className="mt-2 w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <div className="text-center text-xs text-slate-400 mt-4">
              Don't have an account?{' '}
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300">
                Register here
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-emerald-500 hover:text-emerald-400">
              Register here
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
