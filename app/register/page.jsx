"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '../../lib/supabaseClient';

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
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role,
          },
        },
      });

      if (signUpError) throw signUpError;

      // If sign up successful, create profile
      if (data.user) {
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            role: role,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        // Insert profile with role - retries up to 3 times
        let profileCreated = false;
        let retries = 3;
        
        while (!profileCreated && retries > 0) {
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
              id: data.user.id,
              email: email,
              role: role,
            });

          if (!profileError) {
            profileCreated = true;
          } else {
            console.error('Profile creation error:', profileError);
            retries--;
            if (retries === 0) {
              throw new Error('Failed to create user profile after multiple attempts. Please contact support with your email.');
            }
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError(err.message);
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
            Create your account
          </h1>
          <p className="text-sm text-slate-400">
            Join XDrive Logistics as a driver or shipper
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            Registration successful! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-sm">
              Registration successful! Redirecting to login...
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm text-slate-300">Account Type</label>
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
                Driver
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
                Shipper
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-300">Email</label>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-300">Password</label>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-300">Confirm Password</label>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              type="password"
              placeholder="••••••••"
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-500 hover:text-emerald-400">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
