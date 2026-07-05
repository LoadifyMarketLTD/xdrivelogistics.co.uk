import Link from 'next/link';

const rolloutNotes = [
  {
    title: 'Join Early Access',
    description: 'Apply if you want access to the current role-based workspaces and controlled rollout.',
    href: '/register',
    cta: 'Apply now',
  },
  {
    title: 'Request a Quote',
    description: 'Use the live intake path if you want to enter work into the customer-facing workflow first.',
    href: '/request-quote',
    cta: 'Open quote form',
  },
  {
    title: 'Log In',
    description: 'Existing approved users can go straight into the product instead of treating the homepage as a brochure.',
    href: '/login',
    cta: 'Open workspace',
  },
] as const;

export function LaunchSection() {
  return (
    <section className="border-b border-slate-200 bg-[#0f172a] px-4 py-14 text-white sm:px-6" id="rollout">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_520px] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#f5c542]/40 bg-[#f5c542]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5c542]">
            Controlled rollout
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Start from the product path that matches what you need next.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            XDrive is still approval-led, but the homepage should now point visitors toward real next actions: apply, submit work or open the existing workspace.
          </p>
        </div>

        <div className="grid gap-3">
          {rolloutNotes.map((note) => (
            <div key={note.title} className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">{note.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{note.description}</p>
              <Link href={note.href} className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-slate-100">
                {note.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
