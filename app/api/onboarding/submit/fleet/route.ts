import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { FLEET_DOCUMENT_TYPES } from '../../../_lib/onboarding';
import { buildSubmitHandler } from '../../_lib/handlers';
import { fleetPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'fleet_courier',
  payloadSchema: fleetPayloadSchema,
  persist: async ({ userId, applicationId, payload }) => {
    if (!supabaseAdmin) return;

    await supabaseAdmin.from('fleet_compliance_profiles').upsert(
      {
        onboarding_application_id: applicationId,
        user_id: userId,
        legal_company_name: payload.legal_company_name,
        trading_name: payload.trading_name,
        company_number: payload.company_number,
        vat_number: payload.vat_number,
        registered_address: payload.registered_address,
        trading_address: payload.trading_address,
        contact_person: payload.contact_person,
        compliance_contact: payload.compliance_contact,
        transport_contact: payload.transport_contact,
      },
      { onConflict: 'onboarding_application_id' }
    );

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!company?.id) return;

    const { data: existingDocs } = await supabaseAdmin
      .from('company_documents')
      .select('doc_type')
      .eq('onboarding_application_id', applicationId);

    const present = new Set((existingDocs ?? []).map((doc) => doc.doc_type));
    for (const docType of FLEET_DOCUMENT_TYPES) {
      if (present.has(docType)) continue;
      await supabaseAdmin.from('company_documents').insert({
        company_id: company.id,
        onboarding_application_id: applicationId,
        doc_type: docType,
        status: 'pending',
      });
    }
  },
});
