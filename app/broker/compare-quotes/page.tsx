import { redirect } from 'next/navigation';

export default async function BrokerCompareQuotesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawJob = Array.isArray(params.job) ? params.job[0] : params.job;
  redirect(rawJob ? `/broker/bids?job=${encodeURIComponent(rawJob)}` : '/broker/bids');
}
