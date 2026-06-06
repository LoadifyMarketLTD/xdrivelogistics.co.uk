import { faqs } from '../content';

export function FaqSection() {
  return (
    <section className="border-b border-slate-200 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">FAQ</h2>
        <div className="mt-10 space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none text-left text-base font-semibold text-[#0f172a]">
                {faq.q}
                <span className="float-right text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-500">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
