import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { BROKER_DOCUMENT_TYPES } from '../../../_lib/onboarding';
import { buildSubmitHandler } from '../../_lib/handlers';
import { brokerPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'broker_shipper',
  payloadSchema: brokerPayloadSchema,
  persist: async ({ applicationId, companyId }) => {
    if (!supabaseAdmin || !companyId) return;

    // Update company with broker-specific details (already created by handler)
    const { data: existingDocs } = await supabaseAdmin
      .from('company_documents')
      .select('doc_type')
      .eq('onboarding_application_id', applicationId);

    const present = new Set((existingDocs ?? []).map((doc) => doc.doc_type));
    for (const docType of BROKER_DOCUMENT_TYPES) {
      if (present.has(docType)) continue;
      await supabaseAdmin.from('company_documents').insert({
        company_id: companyId,
        onboarding_application_id: applicationId,
        doc_type: docType,
        status: 'pending',
      });
    }
  },
});

