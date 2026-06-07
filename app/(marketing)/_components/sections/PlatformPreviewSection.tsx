'use client';

import { useMemo, useState } from 'react';

import { platformModules } from '../content';
import { HomepageVisualCard } from '../HomepageVisualCard';

export function PlatformPreviewSection() {
  const [activePreview, setActivePreview] =
    useState<(typeof platformModules)[number]['key']>('marketplace');

  const selectedPreview = useMemo(
    () =>
      platformModules.find((module) => module.key === activePreview) ??
      platformModules[0],
    [activePreview],
  );

  return (
    <section className="border-b border-[#e5e7eb] bg-slate-50 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">Platform Preview</h2>
        <p className="mt-3 text-center text-slate-500">Illustrative workspace previews for the MVP and early-access operating model.</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {platformModules.map((module) => (
            <button
              key={module.key}
              type="button"
              onClick={() => setActivePreview(module.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activePreview === module.key
                  ? 'bg-[#1d4ed8] text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {module.title}
            </button>
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_10px_28px_-20px_rgba(15,23,42,0.5)]">
          <div className="group border-b border-[#e5e7eb] bg-slate-100 p-4">
            <HomepageVisualCard
              imageSrc={selectedPreview.image}
              imageAlt={selectedPreview.imageAlt}
              label={`${selectedPreview.title} visual`}
              title={selectedPreview.title}
              icon={selectedPreview.icon}
              tone="slate"
              className="h-[180px] w-full rounded-xl md:h-[220px] lg:h-[320px]"
            />
          </div>
          <div className="border-b border-[#e5e7eb] bg-slate-100 p-5">
            <div className="inline-flex items-center rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1d4ed8]">
              Demo Preview
            </div>
            <div className="ml-2 inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {selectedPreview.status}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-[#0f172a]">{selectedPreview.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{selectedPreview.previewDescription}</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            {selectedPreview.previewItems.map((item) => (
              <article key={item.label} className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Demo content shown for early-access product illustration only.
        </p>
      </div>
    </section>
  );
}
