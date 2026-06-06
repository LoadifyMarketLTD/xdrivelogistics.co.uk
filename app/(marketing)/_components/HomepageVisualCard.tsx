import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';

export type HomepageVisualTone = 'amber' | 'blue' | 'emerald' | 'slate' | 'violet';

interface HomepageVisualCardProps {
  className: string;
  icon: LucideIcon;
  imageAlt: string;
  imageSrc?: string | null;
  label: string;
  priority?: boolean;
  sizes?: string;
  title: string;
  tone: HomepageVisualTone;
}

export function HomepageVisualCard({
  className,
  imageAlt,
  imageSrc,
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: HomepageVisualCardProps) {
  if (!imageSrc) return null;

  const isSvg = imageSrc.toLowerCase().endsWith('.svg');

  return (
    <div className={`group relative overflow-hidden ${className}`}>
      <Image
        src={imageSrc}
        alt={imageAlt}
        width={1600}
        height={900}
        unoptimized={isSvg}
        sizes={sizes}
        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        priority={priority}
      />
    </div>
  );
}
