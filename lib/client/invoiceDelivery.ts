export async function sendGeneratedInvoice(invoiceId: string, tokenOrAuthorization: string) {
  const authorization = tokenOrAuthorization.startsWith('Bearer ')
    ? tokenOrAuthorization
    : `Bearer ${tokenOrAuthorization}`;
  const response = await fetch(`/api/driver/finance/invoices/${encodeURIComponent(invoiceId)}/submit`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const payload = (await response.json().catch(() => null)) as {
    invoice?: { id?: string; status?: string; delivery_recipient_email?: string };
    replayed?: boolean;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Invoice was created but could not be sent.');
  }

  return payload;
}
