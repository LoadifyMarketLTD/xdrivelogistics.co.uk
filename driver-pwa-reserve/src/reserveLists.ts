import type { LiveJob } from './liveApi';

export type ReserveTab = 'Loads' | 'Quotes' | 'Bookings';
export type ReserveCounts = { total: number; open: number; unquoted: number; quoted: number; historyOnly: number; booked: number; offers: number };

export function reserveCounts(jobs: LiveJob[]): ReserveCounts {
  return {
    total: jobs.length,
    open: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed === true).length,
    unquoted: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed === true && j.quote == null).length,
    quoted: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed === true && j.quote != null).length,
    historyOnly: jobs.filter(j => j.status === 'OPEN' && j.marketplaceListed !== true).length,
    booked: jobs.filter(j => j.status !== 'OPEN' && j.quoteOutcome !== 'CANCELLED').length,
    offers: jobs.filter(j => Boolean(j.acceptanceRequired && j.offerId)).length,
  };
}
export function reserveJobs(jobs: LiveJob[], tab: ReserveTab, search = '', vehicle = 'All'): LiveJob[] {
  const needle = search.trim().toLocaleLowerCase();
  // A submitted quote does not remove an otherwise-open load from the Loads market.
  return jobs.filter(j => tab === 'Loads'
    ? j.status === 'OPEN' && j.marketplaceListed === true
    : tab === 'Quotes'
      ? j.quote != null && j.quoteOutcome !== 'CANCELLED'
      : j.status !== 'OPEN' && j.quoteOutcome !== 'CANCELLED'
  ).filter(j => vehicle === 'All' || j.vehicle === vehicle
  ).filter(j => !needle || [j.from, j.to, j.company, j.vehicle, j.id]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
}
