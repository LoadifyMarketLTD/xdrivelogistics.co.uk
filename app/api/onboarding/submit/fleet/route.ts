import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { FLEET_DOCUMENT_TYPES } from '../../../_lib/onboarding';
import { buildSubmitHandler } from '../../_lib/handlers';
import { fleetPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'fleet_courier',
  payloadSchema: fleetPayloadSchema,
  persist: async ({ applicationId, companyId }) => {
    if (!supabaseAdmin || !companyId) return;

    const { data: existingDocs } = await supabaseAdmin
      .from('company_documents')
      .select('doc_type')
      .eq('onboarding_application_id', applicationId);

    const present = new Set((existingDocs ?? []).map((doc) => doc.doc_type));
    for (const docType of FLEET_DOCUMENT_TYPES) {
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

