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

  if (code === '42703') return true;

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
