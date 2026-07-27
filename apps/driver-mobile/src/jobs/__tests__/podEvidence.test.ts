const fileStore = new Map<string, { size: number }>();

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///persist/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const source = fileStore.get(from);
    if (!source) throw new Error(`Missing source: ${from}`);
    fileStore.set(to, { size: source.size });
  }),
  getInfoAsync: jest.fn(async (uri: string) => {
    const file = fileStore.get(uri);
    return file ? { exists: true, size: file.size } : { exists: false, size: 0 };
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    fileStore.delete(uri);
  }),
}));

import { deletePersistedPodEvidence, makeQueuedPodPayloadDurable, readPersistedPodEvidence } from '../podEvidence';

beforeEach(() => {
  fileStore.clear();
});

describe('makeQueuedPodPayloadDurable', () => {
  test('copies queued POD evidence into an app-owned persistent directory with metadata', async () => {
    fileStore.set('file:///cache/photo.jpg', { size: 1024 });
    fileStore.set('file:///cache/proof.pdf', { size: 2048 });

    const payload = await makeQueuedPodPayloadDurable('driver-1', 'job-1', {
      photoUris: ['file:///cache/photo.jpg'],
      documentUris: ['file:///cache/proof.pdf'],
      recipientName: 'Receiver',
      signatureData: 'data:image/png;base64,abc',
      podKey: 'pod-job-1-abc123',
    });

    const photos = readPersistedPodEvidence(payload.photoEvidence, 'photos');
    const documents = readPersistedPodEvidence(payload.documentEvidence, 'documents');
    expect(photos).toHaveLength(1);
    expect(documents).toHaveLength(1);
    expect(photos[0].localUri).toContain('file:///persist/xdrive-driver/pod-evidence/driver-1/job-1/photos/');
    expect(documents[0].localUri).toContain('file:///persist/xdrive-driver/pod-evidence/driver-1/job-1/documents/');
    expect(photos[0].size).toBe(1024);
    expect(documents[0].mimeType).toBe('application/pdf');
  });

  test('reuses previously persisted evidence across restart-style requeue', async () => {
    fileStore.set('file:///cache/photo.jpg', { size: 1024 });

    const firstPayload = await makeQueuedPodPayloadDurable('driver-1', 'job-2', {
      photoUris: ['file:///cache/photo.jpg'],
      documentUris: [],
      recipientName: 'Receiver',
      signatureData: 'data:image/png;base64,abc',
      podKey: 'pod-job-2-abc123',
    });

    const secondPayload = await makeQueuedPodPayloadDurable('driver-1', 'job-2', firstPayload);
    expect(secondPayload.photoEvidence).toEqual(firstPayload.photoEvidence);
    expect(readPersistedPodEvidence(secondPayload.photoEvidence, 'photos')).toHaveLength(1);
  });

  test('throws a recoverable error when selected evidence is missing before queueing', async () => {
    await expect(makeQueuedPodPayloadDurable('driver-1', 'job-3', {
      photoUris: ['file:///cache/missing-photo.jpg'],
      documentUris: [],
      recipientName: 'Receiver',
      signatureData: 'data:image/png;base64,abc',
      podKey: 'pod-job-3-abc123',
    })).rejects.toThrow('The selected POD photo is no longer available. Please add it again.');
  });

  test('deletes persisted evidence after confirmed success', async () => {
    fileStore.set('file:///persist/xdrive-driver/pod-evidence/driver-1/job-4/photos/photo.jpg', { size: 1024 });
    await deletePersistedPodEvidence([{
      evidenceType: 'photos',
      localUri: 'file:///persist/xdrive-driver/pod-evidence/driver-1/job-4/photos/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    }]);
    expect(fileStore.has('file:///persist/xdrive-driver/pod-evidence/driver-1/job-4/photos/photo.jpg')).toBe(false);
  });
});
