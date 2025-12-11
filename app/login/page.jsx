'use client'

import { useState } from 'react'

export const metadata = {
  title: 'Login | XDrive Logistics',
  description: 'Login to XDrive Logistics – loads, routes, profit tracking and more.',
}

export default function LoginPage() {
  const [accountType, setAccountType] = useState('driver')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* STÂNGA – ~70%: video / hero info */}
      <div className="hidden lg:flex flex-1 flex-col justify-between border-r border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Logo + titlu sus */}
        <header className="px-10 pt-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-xs font-semibold tracking-wide">
            XDL
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-slate-400">
              XDrive Logistics
            </div>
            <div className="text-xs text-slate-500">
              by Danny Courier LTD
            </div>
          </div>
        </header>

        {/* Conținut principal (video + text) */}
        <main className="px-10 pb-16">
          {/* “Videoteca” – placeholder pentru video / slideshow */}
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="aspect-[16/9] w-full bg-gradient-to-tr from-indigo-500/40 via-emerald-400/20 to-sky-500/40">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
                <div className="absolute -bottom-12 -right-6 h-44 w-44 rounded-full bg-indigo-500/25 blur-3xl" />
              </div>

              <div className="relative h-full w-full flex flex-col items-start justify-between px-8 py-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-slate-800/80 backdrop-blur">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live marketplace · UK & EU
                </div>

                <div className="space-y-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-50 drop-shadow">
                    Find & manage courier loads in real time
                  </h1>
                  <p className="max-w-xl text-sm text-slate-100/80">
                    Search loads, optimise your route, calculate profit per mile and manage your invoices
                    – all in one place, built for drivers on Courier Exchange style workflows.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-100/90">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/70 ring-1 ring-slate-800 text-[10px]">
                      £
                    </span>
                    <span>Instant profit per mile & job breakdown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/70 ring-1 ring-slate-800 text-[10px]">
                      📍
                    </span>
                    <span>Live jobs map & favourite routes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bullet-uri “ca pe CX desktop” */}
          <div className="grid gap-6 text-sm text-slate-200 md:grid-cols-3">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                For drivers
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Search loads by radius, vehicle & timing</li>
                <li>• See dead miles & profit before you bid</li>
                <li>• Save favourite routes & post-areas</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                For operators
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Assign loads to your fleet in one click</li>
                <li>• Multi-vehicle planner (van, Luton, HGV)</li>
                <li>• Track POD, invoices & payments</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Live insights
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-200">
                <li>• Heatmap of hot zones & busy postcodes</li>
                <li>• Daily job summary & revenue snapshot</li>
                <li>• Export-ready data for your accountant</li>
              </ul>
            </div>
          </div>
        </main>
      </div>

      {/* DREAPTA – panoul de login (similar CX) */}
      <div className="w-full lg:max-w-md bg-slate-950 flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo mic pe mobile */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
                XDrive Logistics
              </div>
              <div className="text-[11px] text-slate-500">
                by Danny Courier LTD
              </div>
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-slate-50 mb-2">
            Log in to your account
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            Enter your details to access loads, routes, profit dashboard and invoices.
          </p>

          {/* Tab / account type selector */}
          <div className="mb-5 inline-flex items-center rounded-full bg-slate-900 p-1 text-[11px] ring-1 ring-slate-800">
            <button
              type="button"
              onClick={() => setAccountType('driver')}
              className={
                'px-3 py-1.5 rounded-full transition ' +
                (accountType === 'driver'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200')
              }
            >
              Driver
            </button>
            <button
              type="button"
              onClick={() => setAccountType('operator')}
              className={
                'px-3 py-1.5 rounded-full transition ' +
                (accountType === 'operator'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200')
              }
            >
              Operator / Shipper
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              // aici vei conecta autentificarea reală (NextAuth / Supabase etc.)
            }}
          >
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">
                Email / Username
              </label>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                type="text"
                name="username"
                autoComplete="username"
                placeholder="driver@xdrive.co.uk"
                required
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-300">
                Password
              </label>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Keep me logged in</span>
              </label>
              <button
                type="button"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Log in
            </button>
          </form>

          {/* Info suplimentară jos, ca la CX */}
          <div className="mt-6 space-y-3 text-[11px] text-slate-500">
            <div className="flex items-center justify-between gap-3">
              <span>Don&apos;t have an account yet?</span>
              <a
                href="#"
                className="font-medium text-emerald-400 hover:text-emerald-300"
              >
                Request onboarding
              </a>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                Support
              </div>
              <div className="space-y-0.5">
                <p>Mon–Fri · 08:00 – 18:00 (UK)</p>
                <p>
                  Phone: <span className="text-slate-200">+44 7323 272 138</span>
                </p>
                <p>
                  Email:{' '}
                  <a
                    href="mailto:support@xdrivelogistics.co.uk"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    support@xdrivelogistics.co.uk
                  </a>
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500/80">
              By logging in you agree to the XDrive Logistics{' '}
              <a href="#" className="text-emerald-400 hover:text-emerald-300">
                Terms of Use
              </a>{' '}
              and{' '}
              <a href="#" className="text-emerald-400 hover:text-emerald-300">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
