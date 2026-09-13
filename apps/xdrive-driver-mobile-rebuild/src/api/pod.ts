import { apiRequest } from './client';

export type DriverPodInput = {
  recipientName: string;
  signatureData: string;
  photoUris: string[];
  damagePhotoUris?: string[];
  documentUris: string[];
  notes?: string;
};

export async function submitPod(jobId: string, input: DriverPodInput) {
  const recipientName = input.recipientName.trim();
  if (!recipientName) throw new Error('Recipient name is required for POD.');
  if (recipientName.length > 200) throw new Error('Recipient name is too long.');
  return apiRequest(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    body: {
      recipientName,
      signatureData: input.signatureData,
      photoUris: input.photoUris,
      damagePhotoUris: input.damagePhotoUris ?? [],
      documentUris: input.documentUris,
      notes: input.notes?.trim() || '',
    },
  });
}
