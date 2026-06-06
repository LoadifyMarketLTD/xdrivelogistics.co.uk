'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

import { platformModules } from '../content';

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
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">Platform Preview</h2>
        <p className="mt-3 text-center text-slate-500">Explore each workspace view across the XDrive platform.</p>

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

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Image src={selectedPreview.image} alt={`${selectedPreview.title} screenshot`} width={1600} height={900} className="h-auto w-full" />
          <div className="border-t border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">{selectedPreview.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{selectedPreview.summary}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
