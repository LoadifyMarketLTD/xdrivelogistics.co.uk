'use client';

import { useState } from 'react';
import { faqs } from '../content';

const visibleFaqs = faqs.slice(0, 7);

export function FAQ() {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set([0]));

  function toggle(index: number) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section id="faq" className="bg-[#f8fafc] px-4 py-14 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[360px_1fr]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">FAQ</span>
          <h2 className="mt-2 text-3xl font-black text-[#0f172a] sm:text-4xl">Clear answers before onboarding.</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Short answers about the platform scope, early access and how XDrive is positioned during MVP.
          </p>
        </div>

        <div className="space-y-3">
          {visibleFaqs.map((faq, index) => {
            const isOpen = openSet.has(index);
            return (
              <article key={faq.q} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-[#0f172a]"
                >
                  {faq.q}
                  <span className="text-lg text-[#1d4ed8]">{isOpen ? '-' : '+'}</span>
                </button>
                {isOpen ? <p className="border-t border-slate-200 px-5 py-4 text-sm leading-6 text-slate-600">{faq.a}</p> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
