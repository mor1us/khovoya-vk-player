/**
 * Убрать повторы, оставив первое вхождение и порядок.
 * Раньше это писалось внутри filter как `!seen.has(k) && !!seen.add(k)` — работало,
 * но читалось как ошибка: побочный эффект прятался в условии.
 */
export function uniqueBy<T, K>(xs: T[], key: (x: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const x of xs) {
    const k = key(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}
