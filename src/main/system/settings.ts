import { app } from 'electron'
import { join } from 'path'
import type { Settings } from '../../shared/types'
import { jsonFile } from './jsonFile'
import { defaultSettings, normalizeSettings, migrateSettings } from './settingsLogic'

const def = () => defaultSettings(join(app.getPath('music'), 'Хвоя'))
const file = jsonFile<unknown>('settings.json', () => null)
const migFile = jsonFile<Record<string, boolean>>('migrations.json', () => ({}))
let cache: Settings | null = null
const listeners: ((s: Settings) => void)[] = []

export const settings = {
  get(): Settings {
    if (cache) return cache
    const m = migrateSettings(file.read(), migFile.read())
    cache = normalizeSettings(m.settings, def())
    try { migFile.write(m.migrations); if (m.settings) file.write(cache) } catch { /* не страшно */ }
    return cache
  },
  set(patch: Partial<Settings>): Settings {
    cache = normalizeSettings({ ...settings.get(), ...patch }, def())
    file.write(cache)
    listeners.forEach((f) => f(cache!))
    return cache
  },
  onChange(f: (s: Settings) => void) { listeners.push(f) }
}
