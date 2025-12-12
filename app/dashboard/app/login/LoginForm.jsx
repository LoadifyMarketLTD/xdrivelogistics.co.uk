// app/login/LoginForm.jsx
"use client";

import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    // aici mai târziu legăm autentificarea reală
    console.log("Login", { email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-xs font-semibold tracking-[0.25em] text-sky-300">
          XDRIVE
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          Login to XDrive Logistics
        </h1>
        <p className="mt-1 text-xs text-slate-300">
          Access loads, routes, earnings and live tracking.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-200 mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-200 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
          />
        </div>
      </div>

      <button
        type="submit"
        className="mt-2 w-full rounded-xl bg-sky-500 py-2 text-sm font-semibold text-white hover:bg-sky-400"
      >
        Log In
      </button>
    </form>
  );
}
