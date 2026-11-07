import type { Settings } from './types'
import { normalizeSettings, migrateSettings } from '../main/system/settingsLogic'

/** Маленькая ячейка хранилища: на компьютере — файл, на телефоне — Preferences. */
export type Slot<T> = { read(): T; write(v: T): void }

export type SettingsStore = {
  get(): Settings
  set(patch: Partial<Settings>): Settings
  onChange(f: (s: Settings) => void): void
}

/**
 * Настройки поверх двух ячеек: сами значения и отметки о сделанных разовых обновлениях.
 * Расчёт (`settingsLogic`) общий для обеих платформ — миграции не должны расходиться.
 */
export function makeSettings(slot: Slot<unknown>, migrations: Slot<Record<string, boolean>>, def: () => Settings): SettingsStore {
  let cache: Settings | null = null
  const listeners: ((s: Settings) => void)[] = []
  return {
    get(): Settings {
      if (cache) return cache
      const m = migrateSettings(slot.read(), migrations.read())
      cache = normalizeSettings(m.settings, def())
      try { migrations.write(m.migrations); if (m.settings) slot.write(cache) } catch { /* не страшно */ }
      return cache
    },
    set(patch: Partial<Settings>): Settings {
      cache = normalizeSettings({ ...this.get(), ...patch }, def())
      slot.write(cache)
      listeners.forEach((f) => f(cache!))
      return cache
    },
    onChange(f) { listeners.push(f) }
  }
}
