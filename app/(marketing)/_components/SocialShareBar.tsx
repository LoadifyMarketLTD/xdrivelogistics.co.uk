'use client';

import { Check, Copy, Mail, Share2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type SocialShareBarProps = { pageTitle: string };

const openPopup = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=760,height=720');
const campaignFromPath = (pathname: string) => {
  const slug = pathname === '/' ? 'homepage' : pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `xdrive_${slug || 'homepage'}_promotion`;
};

export function SocialShareBar({ pageTitle }: SocialShareBarProps) {
  const pathname = usePathname() || '/';
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  useEffect(() => setCanonicalUrl(`${window.location.origin}${pathname}`), [pathname]);

  const trackedUrl = (source: string) => {
    const url = new URL(canonicalUrl || `${window.location.origin}${pathname}`);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', campaignFromPath(pathname));
    url.searchParams.set('utm_content', 'share_button');
    return url.toString();
  };

  const showFeedback = (label: string, duration = 2200) => {
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(null), duration);
  };
  const copyTrackedLink = async () => {
    await navigator.clipboard.writeText(trackedUrl('copy_link'));
    showFeedback('Copied');
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
    showFeedback(fallbackLabel, 2600);
  };
  const shareByEmail = () => {
    const subject = encodeURIComponent(pageTitle);
    const body = encodeURIComponent(`${pageTitle}\n\n${trackedUrl('email')}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const buttons = [
    ['Facebook', () => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackedUrl('facebook'))}`)],
    ['LinkedIn', () => openPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(trackedUrl('linkedin'))}`)],
    ['X', () => openPopup(`https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(trackedUrl('x'))}`)],
    ['WhatsApp', () => openPopup(`https://wa.me/?text=${encodeURIComponent(`${pageTitle} ${trackedUrl('whatsapp')}`)}`)],
    ['Telegram', () => openPopup(`https://t.me/share/url?url=${encodeURIComponent(trackedUrl('telegram'))}&text=${encodeURIComponent(pageTitle)}`)],
    ['Instagram', () => nativeShare('instagram', 'Instagram link copied')],
    ['TikTok', () => nativeShare('tiktok', 'TikTok link copied')],
  ] as const;

  const secondaryClass = 'rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:border-[#F5A300]/60 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#F5A300]/70';

  return (
    <nav className="mt-6 flex w-fit max-w-full flex-wrap items-center gap-2" aria-label={`Share ${pageTitle}`}>
      {buttons.map(([label, onClick]) => (
        <button key={label} type="button" onClick={onClick} className={secondaryClass} aria-label={`Share ${pageTitle} on ${label}`}>
          {label}
        </button>
      ))}
      <button type="button" onClick={shareByEmail} className={`inline-flex items-center gap-1.5 ${secondaryClass}`} aria-label={`Share ${pageTitle} by email`}>
        <Mail className="h-3.5 w-3.5" /> Email
      </button>
      <button type="button" onClick={copyTrackedLink} className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5A300]/45 bg-[#F5A300]/10 px-3 py-2 text-xs font-black text-[#FFD06A] transition hover:bg-[#F5A300]/15 focus:outline-none focus:ring-2 focus:ring-[#F5A300]/70" aria-label={`Copy link for ${pageTitle}`}>
        {copiedLabel ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedLabel || 'Copy link'}
      </button>
      <button type="button" onClick={() => nativeShare('native_share', 'Share link copied')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:border-[#F5A300]/60 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#F5A300]/70" aria-label={`Open device share sheet for ${pageTitle}`}>
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
    </nav>
  );
}
