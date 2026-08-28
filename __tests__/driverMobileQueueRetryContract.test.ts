import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile offline queue retry contract', () => {
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/api/client.ts'),
    'utf8',
  );
  const queueSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/offline/queue.ts'),
    'utf8',
  );
  const orderingSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/offline/queueOrderingHelpers.ts'),
    'utf8',
  );

  it('persists HTTP status in API error messages so replay can recover retry semantics', () => {
    expect(clientSource).toContain('function messageWithHttpStatus(message: string, status: number)');
    expect(clientSource).toContain('`${message} (HTTP ${status})`');
    expect(clientSource).toContain('super(messageWithHttpStatus(message, status))');
  });

  it('classifies permanent 4xx queue failures as manual retry and keeps transient failures automatic', () => {
    expect(queueSource).toContain("retryMode?: 'automatic' | 'manual'");
    expect(queueSource).toContain('const retryableHttpStatuses = new Set([408, 425, 429])');
    expect(queueSource).toContain('export function isPersistedQueueFailureRetryable(lastError: string)');
    expect(queueSource).toContain('status >= 400 && status < 500 && !retryableHttpStatuses.has(status)');
    expect(queueSource).toContain("retryMode: retryable ? 'automatic' : 'manual'");
    expect(queueSource).toContain("if (item.retryMode === 'manual') return false");
  });

  it('prevents generic forced sync from bypassing a terminal failure', () => {
    expect(orderingSource).toContain("if (action.retryMode !== 'manual' && isReady(action))");
    expect(orderingSource).toContain('retryQueueItem explicitly');
  });

  it('allows explicit Retry failed to re-enable the action', () => {
    expect(queueSource).toContain('export async function retryQueueItem');
    expect(queueSource).toContain("status: 'pending'");
    expect(queueSource).toContain("retryMode: 'automatic'");
  });
});
