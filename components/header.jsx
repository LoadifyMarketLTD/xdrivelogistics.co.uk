'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabaseClient } from '../lib/supabaseClient'

export default function Header() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      setUser(session?.user || null)
    }
    
    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabaseClient.auth.signOut()
    setUser(null)
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo / brand */}
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-[0.3em] uppercase text-slate-200">
            XDrive
          </span>
          <span className="hidden sm:inline text-xs text-slate-400">
            Logistics · Danny Courier LTD
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/"
            className="text-slate-200 hover:text-[#D4AF37] transition-colors"
          >
            Home
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-slate-200 hover:text-[#D4AF37] transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/shipments"
                className="text-slate-200 hover:text-[#D4AF37] transition-colors"
              >
                Shipments
              </Link>
              <button
                onClick={handleLogout}
                className="text-slate-200 hover:text-red-400 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/loads"
                className="text-slate-200 hover:text-[#D4AF37] transition-colors"
              >
                Loads
              </Link>
              <Link
                href="/login"
                className="text-slate-200 hover:text-[#D4AF37] transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-md font-medium transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
