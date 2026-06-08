import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { OWNER_DRIVER_DOCUMENT_TYPES } from '../../../_lib/onboarding';
import { buildSubmitHandler } from '../../_lib/handlers';
import { ownerDriverPayloadSchema, parseOwnerDriverDate } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'owner_driver',
  payloadSchema: ownerDriverPayloadSchema,
  persist: async ({ userId, applicationId, payload }) => {
    if (!supabaseAdmin) return;

    await supabaseAdmin.from('owner_driver_compliance_profiles').upsert(
      {
        onboarding_application_id: applicationId,
        user_id: userId,
        full_name: payload.full_name,
        dob: parseOwnerDriverDate(payload.dob),
        nationality: payload.nationality,
        address: payload.address,
        phone: payload.phone,
        email: payload.email,
        right_to_work_status: payload.right_to_work_status,
        visa_type: payload.visa_type || null,
        visa_expiry: payload.visa_expiry ? parseOwnerDriverDate(payload.visa_expiry) : null,
        share_code: payload.share_code || null,
        settled_status: payload.settled_status,
        pre_settled_status: payload.pre_settled_status,
        registration: payload.registration,
        make: payload.make,
        model: payload.model,
        payload: payload.payload,
        dimensions: payload.dimensions,
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

    if (company?.id) {
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDriver?.id) {
        await supabaseAdmin
          .from('drivers')
          .update({
            display_name: payload.full_name,
            phone: payload.phone,
            email: payload.email,
            dob: parseOwnerDriverDate(payload.dob),
            nationality: payload.nationality,
            residential_address: payload.address,
            right_to_work_status: payload.right_to_work_status,
            visa_type: payload.visa_type || null,
            visa_expiry: payload.visa_expiry ? parseOwnerDriverDate(payload.visa_expiry) : null,
            share_code: payload.share_code || null,
            settled_status: payload.settled_status,
            pre_settled_status: payload.pre_settled_status,
            app_access: true,
          })
          .eq('id', existingDriver.id);
      } else {
        await supabaseAdmin.from('drivers').insert({
          company_id: company.id,
          user_id: userId,
          display_name: payload.full_name,
          phone: payload.phone,
          email: payload.email,
          status: 'active',
          app_access: true,
          dob: parseOwnerDriverDate(payload.dob),
          nationality: payload.nationality,
          residential_address: payload.address,
          right_to_work_status: payload.right_to_work_status,
          visa_type: payload.visa_type || null,
          visa_expiry: payload.visa_expiry ? parseOwnerDriverDate(payload.visa_expiry) : null,
          share_code: payload.share_code || null,
          settled_status: payload.settled_status,
          pre_settled_status: payload.pre_settled_status,
        });
      }
    }

    await supabaseAdmin.from('owner_driver_vehicles').upsert(
      {
        onboarding_application_id: applicationId,
        registration: payload.registration,
        make: payload.make,
        model: payload.model,
        payload: payload.payload,
        dimensions: payload.dimensions,
      },
      { onConflict: 'onboarding_application_id' }
    );

    const { data: existingDocs } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('doc_type')
      .eq('onboarding_application_id', applicationId);

    const present = new Set((existingDocs ?? []).map((doc) => doc.doc_type));
    for (const docType of OWNER_DRIVER_DOCUMENT_TYPES) {
      if (present.has(docType)) continue;
      await supabaseAdmin.from('driver_identity_documents').insert({
        onboarding_application_id: applicationId,
        doc_type: docType,
        upload_status: 'missing',
        verification_status: 'unverified',
      });
    }
  },
});
