type ErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase();

export const isMissingColumnError = (
  error: ErrorLike | null | undefined,
  table: string,
  column: string
) => {
  if (!error) return false;
  const code = normalize(error.code);
  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);
  const tableName = table.toLowerCase();
  const columnName = column.toLowerCase();
  const mentionsRequestedColumn = [
    `could not find the '${columnName}' column`,
    `column "${columnName}" does not exist`,
    `${tableName}.${columnName}`,
    `${tableName}"."${columnName}`,
    `"${columnName}"`,
    `'${columnName}'`,
  ].some((signature) =>
    message.includes(signature) || details.includes(signature) || hint.includes(signature)
  );

  if (code === '42703') return mentionsRequestedColumn;

  const signatures = [
    `could not find the '${columnName}' column`,
    `column "${columnName}" does not exist`,
    `${tableName}.${columnName}`,
    `${tableName}"."${columnName}`,
  ];

  return signatures.some((signature) =>
    message.includes(signature) || details.includes(signature) || hint.includes(signature)
  );
};

export const getMissingColumnFromError = (
  error: ErrorLike | null | undefined,
  table: string
): string | null => {
  if (!error) return null;
  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);
  const tableName = table.toLowerCase();
  const haystacks = [message, details, hint].filter(Boolean);

  const singleQuoted = new RegExp(`could not find the '([^']+)' column of '${tableName}'`, 'i');
  for (const text of haystacks) {
    const m = text.match(singleQuoted);
    if (m?.[1]) return m[1].toLowerCase();
  }

  const dotted = new RegExp(`${tableName}\\.([a-z0-9_]+)`, 'i');
  for (const text of haystacks) {
    const m = text.match(dotted);
    if (m?.[1]) return m[1].toLowerCase();
  }

  const generic = /column "([^"]+)" does not exist/i;
  for (const text of haystacks) {
    const m = text.match(generic);
    if (m?.[1]) return m[1].split('.').pop()?.toLowerCase() ?? null;
  }

  return null;
};

export const isMissingRelationshipError = (
  error: ErrorLike | null | undefined,
  sourceTable: string,
  relationshipName: string
) => {
  if (!error) return false;
  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);
  const source = sourceTable.toLowerCase();
  const relation = relationshipName.toLowerCase();
  const signatures = [
    `could not find a relationship between '${source}' and '${relation}'`,
    `could not find a relationship between "${source}" and "${relation}"`,
    `relationship between '${source}' and '${relation}'`,
    `relationship between "${source}" and "${relation}"`,
  ];

  return signatures.some((signature) =>
    message.includes(signature) || details.includes(signature) || hint.includes(signature)
  );
};
