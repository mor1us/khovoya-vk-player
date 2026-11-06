/**
 * Хранилище телефонной Хвои. Наружу — обычный синхронный доступ: окно зовёт settings.get()
 * в десятке мест и ждать там нечего. Preferences у Capacitor асинхронный, поэтому всё
 * читается один раз при старте в память, а запись уходит следом.
 */
export type Store = {
  get<T>(key: string, fallback: T): T
  set(key: string, value: unknown): void
}

/** Для тестов и как запасной вариант, если Preferences недоступен. */
export function memStore(init: Record<string, unknown> = {}): Store {
  const map = new Map<string, unknown>(Object.entries(init))
  return {
    get<T>(key: string, fallback: T): T { return map.has(key) ? (map.get(key) as T) : fallback },
    set(key, value) { map.set(key, value) }
  }
}

type Prefs = {
  keys(): Promise<{ keys: string[] }>
  get(o: { key: string }): Promise<{ value: string | null }>
  set(o: { key: string; value: string }): Promise<void>
}

/** Загружает всё разом и дальше работает из памяти, дублируя записи в Preferences. */
export async function prefsStore(prefs: Prefs): Promise<Store> {
  const map = new Map<string, unknown>()
  try {
    const { keys } = await prefs.keys()
    for (const key of keys) {
      const { value } = await prefs.get({ key })
      if (value === null) continue
      try { map.set(key, JSON.parse(value)) } catch { /* кто-то записал не JSON — пропускаем */ }
    }
  } catch { /* первый запуск или хранилище недоступно — живём с пустым */ }
  return {
    get<T>(key: string, fallback: T): T { return map.has(key) ? (map.get(key) as T) : fallback },
    set(key, value) {
      map.set(key, value)
      void prefs.set({ key, value: JSON.stringify(value) }).catch(() => { /* запись не обязана удаться */ })
    }
  }
}

/** Ячейка поверх хранилища: то, чего ждёт makeSettings. */
export function slotFrom<T>(store: Store, key: string, fallback: T): import('../shared/store').Slot<T> {
  return {
    read: () => store.get<T>(key, fallback),
    write: (v) => store.set(key, v)
  }
}
