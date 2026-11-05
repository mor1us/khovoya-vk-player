/**
 * Чтение сохранённого JSON. Битое или чужое значение не должно ронять интерфейс:
 * вернём запас вместо исключения. Все чтения localStorage в окне идут через это.
 */
export function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null || raw === '') return fallback
  try {
    const v = JSON.parse(raw) as T
    return v === null || v === undefined ? fallback : v
  } catch { return fallback }
}

export function readJson<T>(key: string, fallback: T): T {
  try { return parseJson(localStorage.getItem(key), fallback) } catch { return fallback }
}

/** Запись: место в localStorage может кончиться — это не повод падать. */
export function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* место кончилось */ }
}
