import { statSync } from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';

const MIN_RENDERABLE_IMAGE_BYTES = 1_024;

export type HomepageVisualTone = 'amber' | 'blue' | 'emerald' | 'slate' | 'violet';

const toneClasses: Record<HomepageVisualTone, string> = {
  amber: 'from-[#7c2d12] via-[#ea580c] to-[#f59e0b]',
  blue: 'from-[#0f172a] via-[#1d4ed8] to-[#38bdf8]',
  emerald: 'from-[#022c22] via-[#047857] to-[#2dd4bf]',
  slate: 'from-[#0f172a] via-[#334155] to-[#64748b]',
  violet: 'from-[#312e81] via-[#7c3aed] to-[#c084fc]',
};

const getRenderableImageSource = (imageSrc?: string | null) => {
  if (!imageSrc?.startsWith('/')) return null;

  try {
    const assetPath = path.join(process.cwd(), 'public', imageSrc.slice(1));
    const stats = statSync(assetPath);
    if (!stats.isFile() || stats.size < MIN_RENDERABLE_IMAGE_BYTES) return null;
    return imageSrc;
  } catch {
    return null;
  }
};

interface HomepageVisualCardProps {
  className: string;
  icon: LucideIcon;
  imageAlt: string;
  imageSrc?: string | null;
  label: string;
  priority?: boolean;
  title: string;
  tone: HomepageVisualTone;
}

export function HomepageVisualCard({
  className,
  icon: Icon,
  imageAlt,
  imageSrc,
  label,
  priority = false,
  title,
  tone,
}: HomepageVisualCardProps) {
  const renderableImageSource = getRenderableImageSource(imageSrc);

  if (renderableImageSource) {
    return (
      <Image
        src={renderableImageSource}
        alt={imageAlt}
        width={1600}
        height={900}
        className={`${className} object-cover`}
        priority={priority}
      />
    );
  }

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${toneClasses[tone]}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_48%,rgba(15,23,42,0.18)_100%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/85">
            {label}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)]">
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <div className="max-w-sm">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white/70">Image pending</p>
          <p className="mt-2 text-lg font-semibold leading-tight text-white sm:text-xl">{title}</p>
          <p className="mt-2 text-sm leading-6 text-white/78">
            Licensed production photography will replace this visual before final launch.
          </p>
        </div>
      </div>
    </div>
  );
}
