"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Backend API URL - configurable via environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { register } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('driver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Parolele nu se potrivesc');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Parola trebuie să aibă cel puțin 8 caractere');
      setLoading(false);
      return;
    }

    try {
      // Register with backend API
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_type: role,
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Înregistrarea a eșuat. Te rugăm să încerci din nou.');
      }

      // Register with Express backend API
      await register({
        account_type: role,
        email,
        password,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        setError('Nu s-a putut conecta la serverul backend. Asigurați-vă că API-ul rulează la ' + API_URL);
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl border border-slate-700 bg-slate-900 items-center justify-center text-sm font-semibold tracking-wide mb-4">
            XDL
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 mb-2">
            Creează-ți contul
          </h1>
          <p className="text-sm text-slate-400">
            Alătură-te XDrive Logistics ca șofer sau expeditor
          </p>
        </div>

        <div className="mb-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <strong>Serviciul de autentificare nu este configurat</strong>
          <div className="text-amber-400/80 mt-1">
            Această pagină demonstrativă validează doar local.
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            Înregistrare reușită! Redirecționare către login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="inline-flex w-full items-center rounded-lg bg-slate-900 p-1 text-xs ring-1 ring-slate-800">
              <button
                type="button"
                onClick={() => setRole('driver')}
                className={
                  'flex-1 px-3 py-2 rounded-md transition ' +
                  (role === 'driver'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200')
                }
              >
                Șofer
              </button>
              <button
                type="button"
                onClick={() => setRole('shipper')}
                className={
                  'flex-1 px-3 py-2 rounded-md transition ' +
                  (role === 'shipper'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200')
                }
              >
                Expeditor
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-300">E-mail</label>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              type="email"
              placeholder="email@exemplu.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-300">Parolă</label>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-300">Confirmați parola</label>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Se creează contul...' : 'Creează cont'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Ai deja un cont?{' '}
          <Link href="/login" className="text-emerald-500 hover:text-emerald-400">
            Conectează-te aici
          </Link>
        </p>
      </div>
    </div>
  );
}
