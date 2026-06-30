import Image from 'next/image';
import Link from 'next/link';
import { Bell, CalendarDays, CheckCircle2, Home, MessageSquare, MoreHorizontal, Tag, UserRound, Wifi, type LucideIcon } from 'lucide-react';

type BottomNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
  badge?: string;
};

const bottomNav: BottomNavItem[] = [
  { label: 'Home', icon: Home, active: true, href: '/' },
  { label: 'Alerts', icon: Bell, badge: '7', href: '/request-quote' },
  { label: 'Quotes', icon: Tag, href: '/register' },
  { label: 'Bookings', icon: CalendarDays, href: '/login' },
  { label: 'More', icon: MoreHorizontal, href: '/request-quote' },
] as const;

export function MobileDriverLanding() {
  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#f2f3f7] pb-[76px] text-[#292936] md:hidden">
      <section className="rounded-b-[28px] bg-[#282737] px-4 pb-4 pt-4 text-white shadow-[0_12px_28px_rgba(40,39,55,0.18)]">
        <div className="flex items-center justify-between">
          <Link href="/register" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ffd400] text-[#11111a]">
            <UserRound className="h-6 w-6" aria-hidden="true" />
            <span className="sr-only">Join XDrive</span>
          </Link>

          <Image
            src="/xdrive-logo-horizontal.png"
            alt="XDrive Logistics"
            width={132}
            height={36}
            priority
            className="h-9 w-auto rounded-md bg-white px-1.5 py-1"
          />

          <Link href="/login" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-white">
            <MessageSquare className="h-6 w-6" aria-hidden="true" />
            <span className="sr-only">Log In</span>
          </Link>
        </div>

        <p className="mt-3 text-center text-base font-extrabold text-white/65">Tuesday, June 23</p>

        <div className="mt-3 grid grid-cols-[1fr_104px] gap-3">
          <div className="rounded-2xl bg-white/8 p-3">
            <p className="text-xs font-bold text-white/80">Vehicle</p>
            <p className="mt-1 truncate text-lg font-extrabold">XDRIVE DRIVER</p>
            <p className="mt-2 text-center text-sm font-bold text-white/55">UK</p>
          </div>
          <div className="rounded-2xl bg-white/8 p-3 text-center">
            <p className="text-base font-extrabold">Tracking</p>
            <Wifi className="mx-auto mt-3 h-8 w-8 rotate-45 text-[#63c85a]" aria-hidden="true" />
          </div>
        </div>

        <Link href="/register" className="mt-3 flex h-13 items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
          <span className="text-xs font-bold text-white/75">Status</span>
          <span className="text-lg font-extrabold">Update Your Status</span>
          <span className="text-2xl font-extrabold text-[#ffd400]">&gt;</span>
        </Link>
      </section>

      <section className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="rounded-full bg-[#ffd400] px-3 py-2.5 text-sm font-extrabold text-[#171722]">
            Search
          </button>
          <button type="button" className="rounded-full bg-[#dedfe5] px-3 py-2.5 text-sm font-extrabold text-[#171722]">
            Nearby
          </button>
          <button type="button" className="rounded-full bg-[#dedfe5] px-3 py-2.5 text-sm font-extrabold text-[#171722]">
            Journeys
          </button>
        </div>
      </section>

      <section className="px-4 pt-3">
        <article className="rounded-[22px] bg-white p-4 shadow-[0_14px_28px_rgba(25,25,35,0.10)]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-7 w-7 flex-shrink-0 fill-[#0b4d93] text-white" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight">XDrive Logistics</h1>
              <p className="mt-1 truncate text-xs font-bold text-[#777789]">Today | Small Van | Home location</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg bg-[#e6f5e2] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[#47963d]">NEW</span>
            <span className="rounded-lg bg-[#edf2f8] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[#2468a5]">HOTSHOT</span>
            <span className="rounded-lg bg-[#4aa13d] px-3 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white">EARLY</span>
          </div>

          <div className="mt-3 rounded-2xl border border-[#e2e3e8] p-3">
            <div className="grid grid-cols-[40px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4e95d8] text-sm font-extrabold text-white">1</span>
                <span className="my-1.5 h-5 border-l-4 border-dotted border-[#d5d7df]" />
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4e95d8] text-sm font-extrabold text-white">2</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold">LUTON, LU1</p>
                <p className="mt-0.5 text-xs font-bold text-[#777789]">09:00 - 10:00</p>
                <p className="mt-3 truncate text-lg font-extrabold">MILTON KEYNES, MK9</p>
                <p className="mt-0.5 text-xs font-bold text-[#777789]">ASAP</p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/register" className="flex h-12 items-center justify-center rounded-full bg-[#ffd400] text-base font-extrabold text-black">
              Quote
            </Link>
            <Link href="/login" className="flex h-12 items-center justify-center rounded-full bg-[#282737] text-base font-extrabold text-white">
              Log In
            </Link>
          </div>
        </article>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-50 h-[76px] border-t border-[#ececf1] bg-white px-2 pt-2 shadow-[0_-8px_22px_rgba(25,25,35,0.08)]">
        <div className="grid h-full grid-cols-5">
          {bottomNav.map(({ label, icon: Icon, active, badge, href }) => (
            <Link key={label} href={href} className="relative flex flex-col items-center gap-1 text-[#4a4a58]">
              <span className={`relative flex h-8 w-8 items-center justify-center ${active ? 'text-[#282737]' : ''}`}>
                <Icon className={`h-7 w-7 ${active ? 'fill-current' : ''}`} strokeWidth={2.4} aria-hidden="true" />
                {badge ? <span className="absolute -right-2 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e34b5d] text-[11px] font-extrabold text-white">{badge}</span> : null}
              </span>
              <span className="text-[11px] font-extrabold">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
