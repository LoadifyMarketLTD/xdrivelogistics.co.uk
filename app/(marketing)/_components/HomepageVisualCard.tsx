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
  const renderableImageSource = imageSrc;

  if (renderableImageSource) {
    return (
      <div className={`group relative overflow-hidden ${className}`}>
        <Image
          src={renderableImageSource}
          alt={imageAlt}
          width={1600}
          height={900}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          priority={priority}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/25" />
      </div>
    );
  }

  return null;
}
