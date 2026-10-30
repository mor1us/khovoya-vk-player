import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, renameSync } from 'fs'

/** Маленький JSON-файл в папке данных приложения с атомарной записью. */
export function jsonFile<T>(name: string, fallback: () => T) {
  const path = join(app.getPath('userData'), name)
  return {
    path,
    read(): T { try { return JSON.parse(readFileSync(path, 'utf8')) as T } catch { return fallback() } },
    write(v: T) { const tmp = path + '.tmp'; writeFileSync(tmp, JSON.stringify(v)); renameSync(tmp, path) }
  }
}
