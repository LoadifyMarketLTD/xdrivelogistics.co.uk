/** Escape an untrusted invoice value for a spreadsheet-safe CSV export. */
export function financeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const candidate = raw.replaceAll(String.fromCharCode(0), '').trimStart();
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(candidate);
  const formulaLike = /^[=+@-]/.test(candidate) && !numeric;
  const safe = formulaLike ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
