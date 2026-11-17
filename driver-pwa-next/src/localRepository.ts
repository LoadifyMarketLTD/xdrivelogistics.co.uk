export type LocalRecord<T> = { schemaVersion: 1; savedAt: string; records: T[] }

export function readLocalRecords<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return []
    const candidate = parsed as Partial<LocalRecord<unknown>>
    if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.records)) return []
    return candidate.records.filter(isValid)
  } catch { return [] }
}

export function writeLocalRecords<T>(key: string, records: T[]): void {
  const payload: LocalRecord<T> = { schemaVersion: 1, savedAt: new Date().toISOString(), records }
  localStorage.setItem(key, JSON.stringify(payload))
}

export function isLocalJob(value: unknown): value is { id: string; status: string } {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.status === 'string' && item.id.startsWith('TEST-')
}
