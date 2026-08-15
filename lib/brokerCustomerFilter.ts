export function getBrokerCustomerFilter(searchParams: Pick<URLSearchParams, 'get'>): string | null {
  return searchParams.get('customer');
}
