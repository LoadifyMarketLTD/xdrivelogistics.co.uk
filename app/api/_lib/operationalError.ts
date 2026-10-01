import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export type OperationalErrorOptions = {
  status?: number;
  message: string;
  context: string;
  cause?: unknown;
  retryable?: boolean;
  reason?: string;
  resolution?: string;
};

export function operationalError({
  status = 500,
  message,
  context,
  cause,
  retryable = status >= 500,
  reason,
  resolution,
}: OperationalErrorOptions) {
  const referenceId = `XD-${randomUUID().slice(0, 8).toUpperCase()}`;

  console.error(`[${referenceId}] ${context}`, cause);

  return NextResponse.json(
    {
      error: message,
      referenceId,
      retryable,
      ...(reason ? { reason } : {}),
      ...(resolution ? { resolution } : {}),
    },
    { status },
  );
}
