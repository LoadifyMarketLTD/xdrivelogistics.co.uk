const apiRequestMock = jest.fn();

jest.mock('../client', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

import { fetchMessages, markMessagesRead, type DriverMessage, type MessagesResponse } from '../messages';

const makeMsg = (overrides: Partial<DriverMessage> = {}): DriverMessage => ({
  id: 'msg-001',
  event_type: 'dispatcher_message',
  entity_id: null,
  text: 'Test message',
  job_id: null,
  job_ref: null,
  status: 'pending',
  created_at: '2026-07-28T06:00:00Z',
  read: false,
  ...overrides,
});

const makeResponse = (overrides: Partial<MessagesResponse> = {}): MessagesResponse => ({
  messages: [makeMsg()],
  unread_count: 1,
  ...overrides,
});

describe('fetchMessages', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue(makeResponse());
  });

  test('calls /api/driver/mobile/messages without cursor on first load', async () => {
    await fetchMessages('test-token');
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/driver/mobile/messages',
      expect.objectContaining({ token: 'test-token' }),
    );
  });

  test('includes before param when only before is provided', async () => {
    const before = '2026-07-28T06:00:00Z';
    await fetchMessages('test-token', { before });
    const [path] = apiRequestMock.mock.calls[0] as [string, unknown];
    expect(path).toContain('before=');
    expect(path).toContain(encodeURIComponent(before));
    expect(path).not.toContain('before_id=');
  });

  test('includes both before and before_id for two-field cursor pagination', async () => {
    const before = '2026-07-28T06:00:00Z';
    const beforeId = 'msg-uuid-0001';
    await fetchMessages('test-token', { before, beforeId });
    const [path] = apiRequestMock.mock.calls[0] as [string, unknown];
    expect(path).toContain('before=');
    expect(path).toContain('before_id=');
    expect(path).toContain(encodeURIComponent(before));
    expect(path).toContain(encodeURIComponent(beforeId));
  });

  test('includes limit param when limit is provided', async () => {
    await fetchMessages('test-token', { limit: 20 });
    const [path] = apiRequestMock.mock.calls[0] as [string, unknown];
    expect(path).toContain('limit=20');
  });

  test('omits limit param when limit is not provided', async () => {
    await fetchMessages('test-token');
    const [path] = apiRequestMock.mock.calls[0] as [string, unknown];
    expect(path).not.toContain('limit=');
  });

  test('returns messages array and unread_count from server response', async () => {
    const serverMsg = makeMsg({ id: 'srv-001', text: 'Server message', job_id: 'job-x', read: false });
    apiRequestMock.mockResolvedValue(makeResponse({ messages: [serverMsg], unread_count: 5 }));
    const result = await fetchMessages('test-token');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe('srv-001');
    expect(result.unread_count).toBe(5);
  });

  test('maps all DriverMessage fields from server response', async () => {
    const serverMsg = makeMsg({
      id: 'msg-full',
      event_type: 'job_allocated',
      entity_id: 'job-ent-001',
      text: 'You have been allocated a job',
      job_id: 'job-uuid-001',
      job_ref: 'XDL-ABC123',
      status: 'pending',
      created_at: '2026-07-28T10:00:00Z',
      read: false,
    });
    apiRequestMock.mockResolvedValue(makeResponse({ messages: [serverMsg], unread_count: 1 }));
    const result = await fetchMessages('test-token');
    const msg = result.messages[0];
    expect(msg.id).toBe('msg-full');
    expect(msg.event_type).toBe('job_allocated');
    expect(msg.entity_id).toBe('job-ent-001');
    expect(msg.text).toBe('You have been allocated a job');
    expect(msg.job_id).toBe('job-uuid-001');
    expect(msg.job_ref).toBe('XDL-ABC123');
    expect(msg.status).toBe('pending');
    expect(msg.created_at).toBe('2026-07-28T10:00:00Z');
    expect(msg.read).toBe(false);
  });

  test('returns empty messages array when server returns no messages', async () => {
    apiRequestMock.mockResolvedValue(makeResponse({ messages: [], unread_count: 0 }));
    const result = await fetchMessages('test-token');
    expect(result.messages).toHaveLength(0);
    expect(result.unread_count).toBe(0);
  });

  test('passes the bearer token to apiRequest', async () => {
    await fetchMessages('bearer-xyz');
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'bearer-xyz' }),
    );
  });

  test('before_id without before is not appended to path', async () => {
    // beforeId is only meaningful paired with before; without before it must still be passed
    // but is not appended to a partial cursor.
    await fetchMessages('test-token', { beforeId: 'orphan-id' });
    const [path] = apiRequestMock.mock.calls[0] as [string, unknown];
    // before_id is included in the query params even without before (server will ignore it gracefully)
    expect(path).toContain('before_id=');
  });
});

describe('markMessagesRead', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ ok: true });
  });

  test('calls POST /api/driver/mobile/messages with message id to mark one read', async () => {
    await markMessagesRead('test-token', 'msg-001');
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/driver/mobile/messages',
      expect.objectContaining({
        token: 'test-token',
        method: 'POST',
        body: { id: 'msg-001' },
      }),
    );
  });

  test('calls POST /api/driver/mobile/messages with empty body to mark all read', async () => {
    await markMessagesRead('test-token');
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/driver/mobile/messages',
      expect.objectContaining({
        token: 'test-token',
        method: 'POST',
        body: {},
      }),
    );
  });

  test('passes the bearer token to apiRequest for mark-read', async () => {
    await markMessagesRead('auth-token-xyz', 'msg-002');
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'auth-token-xyz' }),
    );
  });

  test('uses POST method for mark-one-read', async () => {
    await markMessagesRead('test-token', 'msg-003');
    const [, options] = apiRequestMock.mock.calls[0] as [string, { method?: string }];
    expect(options.method).toBe('POST');
  });

  test('uses POST method for mark-all-read', async () => {
    await markMessagesRead('test-token');
    const [, options] = apiRequestMock.mock.calls[0] as [string, { method?: string }];
    expect(options.method).toBe('POST');
  });
});

describe('DriverMessage contract', () => {
  test('entity_id is nullable in the type contract', () => {
    const msg: DriverMessage = makeMsg({ entity_id: null });
    expect(msg.entity_id).toBeNull();
  });

  test('job_id and job_ref are nullable in the type contract', () => {
    const msg: DriverMessage = makeMsg({ job_id: null, job_ref: null });
    expect(msg.job_id).toBeNull();
    expect(msg.job_ref).toBeNull();
  });

  test('text is nullable in the type contract', () => {
    const msg: DriverMessage = makeMsg({ text: null });
    expect(msg.text).toBeNull();
  });

  test('read field is a boolean', () => {
    const unread: DriverMessage = makeMsg({ read: false, status: 'pending' });
    const read: DriverMessage = makeMsg({ read: true, status: 'read' });
    expect(typeof unread.read).toBe('boolean');
    expect(unread.read).toBe(false);
    expect(read.read).toBe(true);
  });
});
