const rolloutNotes = [
  'Approval-based onboarding',
  'Role-based workspace setup',
  'Operational feedback during MVP',
  'Guided rollout for UK transport teams',
] as const;

export function LaunchSection() {
  return (
    <section className="border-b border-slate-200 bg-[#0f172a] px-4 py-14 text-white sm:px-6" id="launch">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#f5c542]/40 bg-[#f5c542]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5c542]">
            Controlled rollout
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Onboard suitable UK transport teams through a controlled rollout.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            XDrive is being introduced through approval-based onboarding, role-specific workspace setup and operational feedback from real transport workflows.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {rolloutNotes.map((note) => (
              <div key={note} className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
                {note}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
