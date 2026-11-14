export type PostLoadWeightUnit = 'kg' | 'lb' | 't';
export type PostLoadDimensionUnit = 'cm' | 'm' | 'in' | 'ft';

const KG_PER_UNIT: Record<PostLoadWeightUnit, number> = {
  kg: 1, lb: 0.45359237, t: 1000,
};
const CM_PER_UNIT: Record<PostLoadDimensionUnit, number> = {
  cm: 1, m: 100, in: 2.54, ft: 30.48,
};

/** Convert to canonical persisted units, without dropping intentionally blank values. */
export function convertPostLoadMeasurement(
  value: string,
  from: PostLoadWeightUnit | PostLoadDimensionUnit,
  to: 'kg' | 'cm',
): string {
  if (value.trim() === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return value;
  const factors = to === 'kg' ? KG_PER_UNIT : CM_PER_UNIT;
  const factor = (factors as Record<string, number>)[from];
  if (factor == null) return value;
  return String(Number((num * factor).toFixed(6)));
}

/** Display-only conversion: no database/API contract changes. */
export function displayPostLoadMeasurement(
  canonical: string,
  unit: PostLoadWeightUnit | PostLoadDimensionUnit,
  source: 'kg' | 'cm',
): string {
  if (canonical.trim() === '') return '';
  const num = Number(canonical);
  if (!Number.isFinite(num) || num < 0) return canonical;
  const factors = source === 'kg' ? KG_PER_UNIT : CM_PER_UNIT;
  const factor = (factors as Record<string, number>)[unit];
  if (factor == null) return canonical;
  return String(Number((num / factor).toFixed(4)));
}
