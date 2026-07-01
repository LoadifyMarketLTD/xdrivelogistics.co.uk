import { buildSubmitHandler } from '../../_lib/handlers';
import { customerPayloadSchema } from '../../_lib/schemas';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';

export const POST = buildSubmitHandler({
  expectedAccountType: 'customer_shipper',
  payloadSchema: customerPayloadSchema,
  persist: async ({ userId, payload, companyId: _companyId }) => {
    if (!supabaseAdmin) return;

    const companyName = payload.company_name.trim() || `${payload.full_name.trim() || 'Customer'} workspace`;
    const contactEmail = payload.contact_email.trim();
    const contactPhone = payload.contact_phone.trim() || null;
    const billingAddress = payload.billing_address.trim() || null;

    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let companyId = existingCompany?.id as string | undefined;

    if (companyId) {
      await supabaseAdmin
        .from('companies')
        .update({
          name: companyName,
          email: contactEmail,
          phone: contactPhone,
          address_line1: billingAddress,
        })
        .eq('id', companyId);
    } else {
      const { data: createdCompany, error: companyError } = await supabaseAdmin
        .from('companies')
        .insert({
          name: companyName,
          email: contactEmail,
          phone: contactPhone,
          address_line1: billingAddress,
          status: 'active',
          company_type: 'standard',
          created_by: userId,
        })
        .select('id')
        .single();

      if (companyError) throw new Error(companyError.message);
      companyId = createdCompany.id as string;
    }

    const { error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .upsert(
        {
          company_id: companyId,
          user_id: userId,
          invited_email: contactEmail,
          role_in_company: 'viewer',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,user_id' }
      );

    if (membershipError) throw new Error(membershipError.message);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: payload.full_name.trim(),
        phone: contactPhone,
        role: 'customer',
        status: 'active',
        company_id: companyId,
        is_driver: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (profileError) throw new Error(profileError.message);
  },
});
