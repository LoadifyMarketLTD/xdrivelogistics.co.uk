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

const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const splitLegacySpecialRequirements = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
};

export const getJobClientFields = (source: JobClientFieldSource): JobClientFields => {
  const runtimeSource = source && typeof source === 'object'
    ? source as Record<string, unknown>
    : {};
  const name = toTrimmedString(runtimeSource.client_name) || 'Unknown';
  let email = toTrimmedString(runtimeSource.client_email);
  let phone = toTrimmedString(runtimeSource.client_phone);
  const cargoNotes: string[] = [];

  for (const part of splitLegacySpecialRequirements(runtimeSource.special_requirements)) {
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
  clientEmail?: string | null;
  clientPhone?: string | null;
  cargoNotes?: string | null;
}) =>
  [toTrimmedString(clientPhone), toTrimmedString(clientEmail), toTrimmedString(cargoNotes)]
    .filter(Boolean)
    .join(' | ');
