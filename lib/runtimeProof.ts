type RuntimeProofPayload = Record<string, unknown>;

type RuntimeProofInput = {
  flow: 'Create Company' | 'Add Driver' | 'Add Vehicle' | 'Upload Documents' | 'Save Settings';
  authUid: string | null;
  membershipId: string | null;
  companyId: string | null;
  payload: RuntimeProofPayload;
  table: string;
  rlsPolicy: string;
};

export const logRuntimeProof = ({
  flow,
  authUid,
  membershipId,
  companyId,
  payload,
  table,
  rlsPolicy,
}: RuntimeProofInput) => {
  console.info('[XDrive Runtime Proof]', {
    flow,
    authUid,
    membershipId,
    companyId,
    payload,
    table,
    rlsPolicy,
  });
};
