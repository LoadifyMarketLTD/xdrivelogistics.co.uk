export type PodDraft = {
  recipientName: string;
  signatureData: string;
  photoUris: string[];
  documentUris: string[];
  podGenerated?: boolean | null;
};

function hasAsset(items: string[]) {
  return items.some((item) => item.trim().length > 0);
}

export function isPodCompleteForSubmission(draft: PodDraft) {
  if (draft.podGenerated) return true;
  const hasRecipient = draft.recipientName.trim().length > 0;
  const hasSignature = draft.signatureData.trim().length > 0;
  const hasPhotoOrDocument = hasAsset(draft.photoUris) || hasAsset(draft.documentUris);
  return hasRecipient && hasSignature && hasPhotoOrDocument;
}
