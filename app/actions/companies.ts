'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Inițializăm clientul de admin (Service Role) care rulează strict securizat pe server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RegistrationResult {
  success: boolean;
  error?: string;
  companyId?: string;
}

/**
 * Validează un număr de companie din UK prin intermediul Companies House API
 * și înregistrează entitatea în platforma XDrive doar dacă statusul este 'active'.
 */
export async function registerValidatedCompany(
  companyNumber: string, 
  userId: string
): Promise<RegistrationResult> {
  try {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) {
      console.error('CRITICAL: COMPANIES_HOUSE_API_KEY is missing from environment variables.');
      return { success: false, error: 'Configurație server invalidă. Contactați asistența.' };
    }

    // 1. Apelăm API-ul oficial guvernamental din UK (Link corectat)
    const authHeader = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch(`https://service.gov.uk{companyNumber}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 } // Cache-uim rezultatul pentru o oră pentru a proteja cota de API
    });

    if (!response.ok) {
      return { success: false, error: 'Numărul introdus nu a fost găsit în registrul oficial Companies House.' };
    }

    const companyData = await response.json();

    // 2. Regula de business XDrive: Permitem înregistrarea doar dacă firma este activă la stat
    if (companyData.company_status !== 'active') {
      return { 
        success: false, 
        error: `Înregistrare respinsă. Această companie are statusul guvernamental '${companyData.company_status}'. Permitem accesul doar firmelor active.` 
      };
    }

    // 3. Inserăm entitatea verificată în tabela 'companies' folosind drepturile admin
    const { data: newCompany, error: dbError } = await supabaseAdmin
      .from('companies')
      .insert([
        {
          name: companyData.company_name,
          registration_number: companyNumber,
          status: 'pending_approval', // Intră automat în coada de verificare a asigurărilor din /super-admin
        }
      ])
      .select('id')
      .single();

    if (dbError) {
      console.error('Database insertion error during company onboarding:', dbError.message);
      return { success: false, error: 'Eroare la salvarea profilului companiei în baza de date.' };
    }

    // 4. Legăm automat utilizatorul care a inițiat cererea ca fiind Administrator (Company Admin) al noii firme
    const { error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .insert([
        {
          company_id: newCompany.id,
          member_id: userId,
          role: 'company_admin',
          status: 'accepted' // Acest utilizator este direct acceptat ca administrator al propriei firme
        }
      ]);

    if (membershipError) {
      console.error('Error generating administrative membership node:', membershipError.message);
      return { success: false, error: 'Compania a fost creată, dar asocierea contului tău a eșuat.' };
    }

    // Curățăm cache-ul paginii de aprobări din noul tău panou de Super Admin pentru a afișa datele instant
    revalidatePath('/super-admin/companies/approvals');
    
    return { success: true, companyId: newCompany.id };

  } catch (err) {
    console.error('Unexpected fatal exception on registerValidatedCompany runtime:', err);
    return { success: false, error: 'Eroare critică de sistem la procesarea înregistrării.' };
  }
}
