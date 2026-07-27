const uploadMock = jest.fn();
const apiRequestMock = jest.fn();
const deletePersistedPodEvidenceMock = jest.fn(async (_values?: unknown) => undefined);
const getInfoAsyncMock = jest.fn(async (_uri?: unknown) => ({ exists: true }));

jest.mock('../client', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

jest.mock('../../auth/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => uploadMock(...args),
      }),
    },
  },
}));

jest.mock('../../jobs/podEvidence', () => ({
  deletePersistedPodEvidence: (values: unknown) => deletePersistedPodEvidenceMock(values),
  readPersistedPodEvidence: (values: unknown, kind: 'photos' | 'documents') =>
    Array.isArray(values)
      ? values.filter((value) => value && typeof value === 'object' && (value as { evidenceType?: string }).evidenceType === kind)
      : [],
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: (uri: string) => getInfoAsyncMock(uri),
}));

import { uploadPod } from '../jobs';

describe('uploadPod', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    apiRequestMock.mockReset();
    deletePersistedPodEvidenceMock.mockClear();
    getInfoAsyncMock.mockReset();
    getInfoAsyncMock.mockResolvedValue({ exists: true });
    global.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })) as unknown as typeof fetch;
  });

  test('deletes persisted local evidence only after successful server confirmation', async () => {
    uploadMock.mockResolvedValue({ error: null });
    apiRequestMock.mockResolvedValue({ ok: true, job: { id: 'job-1' } });

    await uploadPod('job-1', 'token', {
      podKey: 'pod-job-1-abc123',
      photoEvidence: [{
        evidenceType: 'photos',
        localUri: 'file:///persist/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 123,
      }],
      documentEvidence: [{
        evidenceType: 'documents',
        localUri: 'file:///persist/doc.pdf',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 456,
      }],
    });

    expect(deletePersistedPodEvidenceMock).toHaveBeenCalledTimes(2);
  });

  test('keeps local evidence on failed submission and reuses the same storage path on retry', async () => {
    uploadMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'The resource already exists' } });
    apiRequestMock
      .mockRejectedValueOnce(new Error('Temporary API failure'))
      .mockResolvedValueOnce({ ok: true, job: { id: 'job-2' } });

    const payload = {
      podKey: 'pod-job-2-abc123',
      photoEvidence: [{
        evidenceType: 'photos',
        localUri: 'file:///persist/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 123,
      }],
      documentEvidence: [],
    };

    await expect(uploadPod('job-2', 'token', payload)).rejects.toThrow('Temporary API failure');
    expect(deletePersistedPodEvidenceMock).not.toHaveBeenCalled();

    await expect(uploadPod('job-2', 'token', payload)).resolves.toEqual({ ok: true, job: { id: 'job-2' } });

    const firstStoragePath = uploadMock.mock.calls[0][0];
    const secondStoragePath = uploadMock.mock.calls[1][0];
    expect(firstStoragePath).toBe('job-2/photos/pod-job-2-abc123/photo.jpg');
    expect(secondStoragePath).toBe(firstStoragePath);
    expect(deletePersistedPodEvidenceMock).toHaveBeenCalledTimes(2);
  });

  test('returns a recoverable error when persisted local evidence is missing at replay time', async () => {
    getInfoAsyncMock.mockResolvedValue({ exists: false });

    await expect(uploadPod('job-3', 'token', {
      podKey: 'pod-job-3-abc123',
      photoEvidence: [{
        evidenceType: 'photos',
        localUri: 'file:///persist/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 123,
      }],
      documentEvidence: [],
    })).rejects.toThrow('Saved POD evidence is missing from this device. Please recapture it before retrying.');

    expect(uploadMock).not.toHaveBeenCalled();
    expect(deletePersistedPodEvidenceMock).not.toHaveBeenCalled();
  });
});
