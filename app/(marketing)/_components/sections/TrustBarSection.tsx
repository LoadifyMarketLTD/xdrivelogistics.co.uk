const metrics = [
  { label: 'Lifecycle', value: 'Request to POD' },
  { label: 'Workspaces', value: 'Customer, Broker, Fleet' },
  { label: 'Operations', value: 'Jobs, Drivers, Documents' },
  { label: 'Access', value: 'Approved Early Access' },
] as const;

export function TrustBarSection() {
  return (
    <section className="border-b border-[#0B2F6B]/15 bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((item) => (
          <article key={item.label} className="rounded-lg border border-[#0B2F6B]/15 bg-[#F4F6F8] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0B2F6B]">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-[#1A1F2B]">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
