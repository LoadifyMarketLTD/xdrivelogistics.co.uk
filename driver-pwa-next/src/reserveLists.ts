import type { LiveJob } from './liveApi';

export type ReserveTab = 'Loads' | 'Quotes' | 'Bookings';
export type QuoteSection = 'Submitted' | 'Awarded' | 'History';
export type ReserveCounts = { total: number; open: number; unquoted: number; quoted: number; historyOnly: number; booked: number; offers: number };

const withdrawn = (j:LiveJob) => j.bidStatus === 'withdrawn' || j.quoteOutcome === 'CANCELLED';
const hasActiveQuote = (j:LiveJob) => j.quote != null && !withdrawn(j);

export function reserveCounts(jobs: LiveJob[]): ReserveCounts {
  return {
    total: jobs.length,
    open: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed === true).length,
    unquoted: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed === true && !hasActiveQuote(j)).length,
    quoted: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed === true && hasActiveQuote(j)).length,
    historyOnly: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed !== true).length,
    booked: jobs.filter(j => j.status !== 'OPEN' && j.quoteOutcome !== 'CANCELLED').length,
    offers: jobs.filter(j => Boolean(j.acceptanceRequired && j.offerId)).length,
  };
}

export function reserveJobs(jobs:LiveJob[], tab:ReserveTab, search='', vehicle='All', quoteSection:QuoteSection='Submitted'):LiveJob[] {
  const needle=search.trim().toLocaleLowerCase();
  return jobs.filter(j=>tab==='Loads'
    // Loads shows ALL currently posted marketplace jobs, including previously quoted jobs.
    // Quote management actions live exclusively in Quotes.
    ? j.status==='OPEN' && j.marketplaceListed===true
    : tab==='Quotes'
      ? j.personalBid===true && j.quote!=null && (quoteSection==='History'
          ? withdrawn(j)||j.quoteOutcome==='UNSUCCESSFUL'
          : quoteSection==='Awarded'
            ? j.quoteOutcome==='AWARDED'||j.bidStatus==='accepted'
            : j.bidStatus==='submitted'&&j.quoteOutcome!=='AWARDED')
      : (Boolean(j.acceptanceRequired && j.offerId) || j.status!=='OPEN') && j.quoteOutcome!=='CANCELLED'
  ).filter(j=>vehicle==='All'||j.vehicle===vehicle
  ).filter(j=>!needle||[j.from,j.to,j.company,j.vehicle,j.id]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle)).sort((a,b)=>a.id.localeCompare(b.id));
}
