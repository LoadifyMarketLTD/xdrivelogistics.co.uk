import { faqs } from '../content';

export function FaqSection() {
  return (
    <section className="border-b border-slate-200 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">FAQ</h2>
        <p className="mx-auto mt-3 max-w-3xl text-center text-slate-500">
          A clearer set of answers about platform scope, early access, finance records and the current MVP position.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between text-left text-base font-semibold text-[#0f172a]">
                {faq.q}
                <span className="ml-3 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-500">
                {faq.a.split('\n\n').map((para, i) => (
                  <p key={i}>{para.trim()}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
