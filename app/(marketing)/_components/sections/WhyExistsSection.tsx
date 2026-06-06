import Image from 'next/image';

export function WhyExistsSection() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-20 sm:px-6" id="resources">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Why XDrive Exists</h2>
          <div className="mt-6 space-y-3 text-slate-600">
            <p>Most logistics software solves only part of the workflow.</p>
            <p>Load boards find work.</p>
            <p>Dispatch systems manage operations.</p>
            <p>POD systems store delivery proof.</p>
            <p>Finance systems create invoices.</p>
            <p className="font-semibold text-[#0f172a]">XDrive connects the entire logistics journey into one operational platform.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <Image
            src="/homepage/why-exists-scene.svg"
            alt="UK logistics environment, warehouse and vehicle activity"
            width={1600}
            height={900}
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
