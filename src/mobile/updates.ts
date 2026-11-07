import type { UpdateState } from '../shared/updates'

/** Номер версии как список чисел: 0.4.9 должно быть меньше 0.4.22, а не наоборот по алфавиту. */
const nums = (v: string) => v.replace(/^v/, '').split('.').map((x) => Number(x) || 0)

export function newerThan(a: string, b: string): boolean {
  const x = nums(a), y = nums(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d > 0
  }
  return false
}

type Release = { tag_name?: string; assets?: { name?: string; browser_download_url?: string }[] }

/** Что скачивать, если выпуск новее нашей версии и в нём есть apk. */
export function apkFromRelease(release: Release | null | undefined, current: string): { version: string; url: string } | null {
  const tag = release?.tag_name
  if (!tag || !newerThan(tag, current)) return null
  const apk = release.assets?.find((a) => a.name?.toLowerCase().endsWith('.apk'))
  if (!apk?.browser_download_url) return null
  return { version: tag.replace(/^v/, ''), url: apk.browser_download_url }
}

export type UpdateDeps = {
  current: string
  owner: string
  repo: string
  fetch: typeof fetch
  /** Нативная загрузка: apk — двоичный файл, через обычный ответ его не пронести. */
  download(url: string): Promise<string>
  install(path: string): Promise<void>
  onChange(s: UpdateState): void
  log(m: string): void
}

/**
 * Обновление на телефоне. На компьютере этим занимается electron-updater,
 * здесь — то же самое руками: посмотреть выпуски, скачать apk, открыть установщик.
 */
export function makeUpdates(deps: UpdateDeps) {
  let state: UpdateState = { status: 'idle', current: deps.current }
  let found: { version: string; url: string } | null = null

  const set = (s: UpdateState) => { state = s; deps.onChange(s) }

  const check = async (): Promise<UpdateState> => {
    set({ status: 'checking', current: deps.current })
    try {
      const res = await deps.fetch(`https://api.github.com/repos/${deps.owner}/${deps.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      const json = (await res.json()) as Release
      found = apkFromRelease(json, deps.current)
      set(found ? { status: 'available', version: found.version, current: deps.current } : { status: 'none', current: deps.current })
    } catch (e) {
      deps.log(`проверка обновлений: ${(e as Error).message}`)
      set({ status: 'error', current: deps.current })
    }
    return state
  }

  const download = async () => {
    if (!found) return
    set({ status: 'downloading', version: found.version, current: deps.current, progress: 0 })
    try {
      const path = await deps.download(found.url)
      // на телефоне перезапускать нечего: сразу открываем установщик Android
      set({ status: 'ready', version: found.version, current: deps.current })
      await deps.install(path)
    } catch (e) {
      deps.log(`загрузка обновления: ${(e as Error).message}`)
      set({ status: 'error', current: deps.current })
    }
  }

  return { get: () => state, check, download, install: download }
}
