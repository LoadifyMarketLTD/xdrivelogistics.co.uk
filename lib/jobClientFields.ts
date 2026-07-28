type JobClientFieldSource = {
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  load_details?: string | null;
  special_requirements?: string | null;
};

export type JobClientFields = {
  name: string;
  email: string;
  phone: string;
  cargoNotes: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_PATTERN = /^\+?[0-9()\-\s]{6,}$/;

const splitLegacySpecialRequirements = (value: string | null | undefined) =>
  (value ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

export const getJobClientFields = (source: JobClientFieldSource): JobClientFields => {
  const name = source.client_name?.trim() || 'Unknown';
  let email = source.client_email?.trim() || '';
  let phone = source.client_phone?.trim() || '';
  const cargoNotes: string[] = [];

  for (const part of splitLegacySpecialRequirements(source.special_requirements)) {
    if (!email && EMAIL_PATTERN.test(part)) {
      email = part;
      continue;
    }

    if (!phone && PHONE_PATTERN.test(part)) {
      phone = part;
      continue;
    }

    if (part !== name) {
      cargoNotes.push(part);
    }
  }

  return {
    name,
    email,
    phone,
    cargoNotes: cargoNotes.join(' | '),
  };
};

export const buildLegacyJobSpecialRequirements = ({
  clientEmail,
  clientPhone,
  cargoNotes,
}: {
  clientEmail?: string;
  clientPhone?: string;
  cargoNotes?: string;
}) =>
  [clientPhone?.trim(), clientEmail?.trim(), cargoNotes?.trim()]
    .filter(Boolean)
    .join(' | ');
