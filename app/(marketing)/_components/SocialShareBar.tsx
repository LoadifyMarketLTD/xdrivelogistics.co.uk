'use client';

import { Check, Copy, Mail, Share2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

type SocialShareBarProps = {
  pageTitle: string;
};

const openPopup = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer,width=760,height=720');
};

const campaignFromPath = (pathname: string) => {
  const slug = pathname === '/' ? 'homepage' : pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `xdrive_${slug || 'homepage'}_promotion`;
};

export function SocialShareBar({ pageTitle }: SocialShareBarProps) {
  const pathname = usePathname() || '/';
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const canonicalUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${pathname}`;
  }, [pathname]);

  const trackedUrl = (source: string) => {
    const url = new URL(canonicalUrl || `${window.location.origin}${pathname}`);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', campaignFromPath(pathname));
    url.searchParams.set('utm_content', 'share_button');
    return url.toString();
  };

  const copyTrackedLink = async (source = 'copy_link', label = 'Link copied') => {
    await navigator.clipboard.writeText(trackedUrl(source));
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(null), 2200);
  };

  const nativeShare = async (source: string, fallbackLabel: string) => {
    const url = trackedUrl(source);
    if (navigator.share) {
      try {
        await navigator.share({ title: pageTitle, text: `Discover ${pageTitle} on XDrive Logistics.`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiedLabel(fallbackLabel);
    window.setTimeout(() => setCopiedLabel(null), 2600);
  };

  const buttons = [
    {
      label: 'Facebook',
      onClick: () => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackedUrl('facebook'))}`),
    },
    {
      label: 'LinkedIn',
      onClick: () => openPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(trackedUrl('linkedin'))}`),
    },
    {
      label: 'X',
      onClick: () => openPopup(`https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(trackedUrl('x'))}`),
    },
    {
      label: 'WhatsApp',
      onClick: () => openPopup(`https://wa.me/?text=${encodeURIComponent(`${pageTitle} ${trackedUrl('whatsapp')}`)}`),
    },
    {
      label: 'Telegram',
      onClick: () => openPopup(`https://t.me/share/url?url=${encodeURIComponent(trackedUrl('telegram'))}&text=${encodeURIComponent(pageTitle)}`),
    },
    {
      label: 'Instagram',
      onClick: () => nativeShare('instagram', 'Instagram link copied — paste it into your post'),
    },
    {
      label: 'TikTok',
      onClick: () => nativeShare('tiktok', 'TikTok link copied — paste it into your post'),
    },
  ] as const;

  return (
    <div className="mt-7 w-full max-w-[980px] rounded-[18px] border border-white/15 bg-white/[0.06] p-4 shadow-[0_14px_34px_rgba(5,20,46,0.18)] backdrop-blur-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5A300] text-[#102B55]">
            <Share2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-white">Promote this page</p>
            <p className="text-xs font-semibold text-white/65">Share this exact XDrive page with campaign tracking.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {buttons.map(button => (
            <button
              key={button.label}
              type="button"
              onClick={button.onClick}
              className="rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:border-[#F5A300]/60 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#F5A300]/70"
              aria-label={`Share ${pageTitle} on ${button.label}`}
            >
              {button.label}
            </button>
          ))}
          <a
            href={`mailto:?subject=${encodeURIComponent(pageTitle)}&body=${encodeURIComponent(`${pageTitle}\n\n${canonicalUrl}`)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:border-[#F5A300]/60 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#F5A300]/70"
            aria-label={`Share ${pageTitle} by email`}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
          <button
            type="button"
            onClick={() => copyTrackedLink()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5A300] px-3 py-2 text-xs font-black text-[#102B55] transition hover:bg-[#ffb31a] focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label={`Copy tracked link for ${pageTitle}`}
          >
            {copiedLabel ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLabel || 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => nativeShare('native_share', 'Share link copied')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5A300]/55 bg-[#F5A300]/10 px-3 py-2 text-xs font-black text-[#FFD06A] transition hover:bg-[#F5A300]/15 focus:outline-none focus:ring-2 focus:ring-[#F5A300]/70"
            aria-label={`Open device share sheet for ${pageTitle}`}
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
