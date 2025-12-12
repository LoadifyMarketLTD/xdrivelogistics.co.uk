'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import supabaseClient from '../../lib/supabaseClient'

export default function RegisterPage() {
  const router = useRouter()
  const [role, setRole] = useState('driver')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            role, // Store role in user metadata
          },
        },
      })

      if (error) throw error

      // Redirect to dashboard after successful registration
      router.push('/dashboard')
    } catch (err) {
      setError(err.message || 'Failed to register')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* LEFT PANEL - INFO SECTION */}
      <div className="hidden lg:flex flex-1 flex-col justify-between border-r border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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

        <main className="px-10 pb-16">
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="aspect-[16/9] w-full bg-gradient-to-tr from-indigo-500/40 via-emerald-400/20 to-sky-500/40" />
          </div>

          <div className="grid gap-6 text-sm text-slate-200 md:grid-cols-3">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                For drivers
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Browse available shipments</li>
                <li>• Submit competitive offers</li>
                <li>• Track your earnings</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                For shippers
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Post shipment requests</li>
                <li>• Compare driver offers</li>
                <li>• Manage deliveries</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Join today
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Free to sign up</li>
                <li>• Instant access</li>
                <li>• Secure platform</li>
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
            Sign up to start shipping or driving with XDrive Logistics.
          </p>

          {/* Role selector */}
          <div className="mb-5 inline-flex items-center rounded-full bg-slate-900 p-1 text-[11px] ring-1 ring-slate-800">
            <button
              type="button"
              onClick={() => setRole('driver')}
              className={
                'px-3 py-1.5 rounded-full transition ' +
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
                'px-3 py-1.5 rounded-full transition ' +
                (role === 'shipper'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200')
              }
            >
              Shipper
            </button>
          </div>

          {/* REGISTER FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">Email</label>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                type="email"
                placeholder="you@example.com"
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
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-400 text-center">
            Already have an account?{' '}
            <a href="/login" className="text-emerald-400 hover:text-emerald-300">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
