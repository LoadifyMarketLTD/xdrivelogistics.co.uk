import { isPodCompleteForSubmission } from '../podValidation';

describe('isPodCompleteForSubmission', () => {
  const base = {
    recipientName: 'Receiver Name',
    signatureData: 'data:image/png;base64,abc123',
    photoUris: [] as string[],
    documentUris: [] as string[],
  };

  test('rejects recipient + photo only', () => {
    expect(
      isPodCompleteForSubmission({
        ...base,
        signatureData: '',
        photoUris: ['file:///photo.jpg'],
      }),
    ).toBe(false);
  });

  test('rejects recipient + signature only', () => {
    expect(isPodCompleteForSubmission(base)).toBe(false);
  });

  test('rejects recipient + document only', () => {
    expect(
      isPodCompleteForSubmission({
        ...base,
        signatureData: '',
        documentUris: ['file:///doc.pdf'],
      }),
    ).toBe(false);
  });

  test('accepts recipient + signature + photo', () => {
    expect(
      isPodCompleteForSubmission({
        ...base,
        photoUris: ['file:///photo.jpg'],
      }),
    ).toBe(true);
  });

  test('accepts recipient + signature + document', () => {
    expect(
      isPodCompleteForSubmission({
        ...base,
        documentUris: ['file:///doc.pdf'],
      }),
    ).toBe(true);
  });

  test('rejects incomplete form even when POD already exists on the server', () => {
    expect(
      isPodCompleteForSubmission({
        recipientName: '',
        signatureData: '',
        photoUris: [],
        documentUris: [],
      }),
    ).toBe(false);
  });
});
