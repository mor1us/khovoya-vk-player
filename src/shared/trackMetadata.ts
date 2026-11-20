/** Оставляем ту точность, с которой известна дата релиза. */
export function releaseDateOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T\d{2}:.*)?$/.exec(value.trim())
  if (!match) return
  const [, year, month, day] = match
  if (Number(year) < 1000 || (month && (Number(month) < 1 || Number(month) > 12))) return
  if (day && (!month || Number(day) < 1 || Number(day) > new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate())) return
  return [year, month, day].filter(Boolean).join('-')
}

export function normalizeIsrc(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const code = value.trim().replaceAll('-', '').toUpperCase()
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(code) ? code : undefined
}
