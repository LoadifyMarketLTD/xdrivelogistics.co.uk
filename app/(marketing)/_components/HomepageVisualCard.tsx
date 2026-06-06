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
  title: string;
  tone: HomepageVisualTone;
}

export function HomepageVisualCard({
  className,
  imageAlt,
  imageSrc,
  priority = false,
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
        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        priority={priority}
      />
    </div>
  );
}
