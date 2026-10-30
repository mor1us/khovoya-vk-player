import { app } from 'electron'
import { join } from 'path'
import type { Settings } from '../../shared/types'
import { jsonFile } from './jsonFile'
import { defaultSettings, normalizeSettings } from './settingsLogic'

const def = () => defaultSettings(join(app.getPath('music'), 'Хвоя'))
const file = jsonFile<unknown>('settings.json', () => null)
let cache: Settings | null = null
const listeners: ((s: Settings) => void)[] = []

export const settings = {
  get(): Settings { return (cache ??= normalizeSettings(file.read(), def())) },
  set(patch: Partial<Settings>): Settings {
    cache = normalizeSettings({ ...settings.get(), ...patch }, def())
    file.write(cache)
    listeners.forEach((f) => f(cache!))
    return cache
  },
  onChange(f: (s: Settings) => void) { listeners.push(f) }
}
