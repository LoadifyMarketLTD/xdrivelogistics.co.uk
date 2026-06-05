'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Inițializăm clientul administrativ (Service Role) care rulează exclusiv pe server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Schimbă statusul unei companii din 'pending_approval' în 'approved' sau 'rejected'.
 */
export async function updateCompanyStatus(
  companyId: string, 
  nextStatus: 'approved' | 'rejected'
) {
  try {
    // Aplicăm modificarea direct în tabela ta 'companies'
    const { error } = await supabaseAdmin
      .from('companies')
      .update({ status: nextStatus })
      .eq('id', companyId);

    if (error) {
      throw new Error(`Eroare la actualizarea statusului: ${error.message}`);
    }

    // Curățăm cache-ul Next.js pentru ca tabelul să se actualizeze instant pe ecran
    revalidatePath('/super-admin/companies/approvals');
    return { success: true };

  } catch (err) {
    console.error(err);
    return { success: false, error: 'Eroare de sistem la procesarea acțiunii.' };
  }
}
