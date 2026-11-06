import { app } from 'electron'
import { join } from 'path'
import type { Settings } from '../../shared/types'
import { jsonFile } from './jsonFile'
import { defaultSettings } from './settingsLogic'
import { makeSettings } from '../../shared/store'

const def = (): Settings => defaultSettings(join(app.getPath('music'), 'Хвоя'))

/** Те же настройки, что на телефоне, только ячейки — файлы в папке приложения. */
export const settings = makeSettings(
  jsonFile<unknown>('settings.json', () => null),
  jsonFile<Record<string, boolean>>('migrations.json', () => ({})),
  def
)
