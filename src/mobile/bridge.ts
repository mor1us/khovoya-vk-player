import { registerCore, type Handle, type CoreCtx } from '../shared/channels'
import { friendly } from '../shared/friendly'
import { isAllowedChannel, type Channel, type IpcArgs, type IpcResult } from '../shared/ipc'
import type { EventMap, EventName } from '../shared/ipc'
import type { AudioApi } from '../main/vk/audio'
import type { DiscordUpdate, LoginStep, Session, Settings, Track, LocalPl, WaveProfile } from '../shared/types'
import type { UpdateState } from '../shared/updates'
import { makeSettings } from '../shared/store'
import { slotFrom, type Store } from './storage'
import { defaultSettings } from '../main/system/settingsLogic'

export type BridgeDeps = {
  api: AudioApi
  store: Store
  session(): Promise<Session>
  login(): Promise<LoginStep>
  logout(): Promise<void> | void
  /** Что сейчас играет — уходит в фоновую службу и на экран блокировки. */
  now?(u: DiscordUpdate): void
  /** Обновления Хвои на телефоне. Нет — каналы отвечают «выключено». */
  updates?: { get(): UpdateState; check(): Promise<UpdateState>; download(): Promise<void>; install(): Promise<void> }
  log?(m: string): void
}

/** Ответ на капчу ждут здесь: канал живёт, только пока ВК её спрашивает. */
let captchaWaiting: ((key: string) => void) | null = null

const listeners = new Map<EventName, ((p: unknown) => void)[]>()

/** Событие окну: то же, что `webContents.send` на компьютере. */
export function emit<E extends EventName>(event: E, payload?: EventMap[E]) {
  for (const f of listeners.get(event) ?? []) { try { f(payload) } catch { /* слушатель сам виноват */ } }
}

/** ВК просит капчу: показываем её окну и ждём ответа. */
export function askCaptcha(sid: string, imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    captchaWaiting = resolve
    emit('vk:captcha', { sid, imageDataUrl })
  })
}

// Экраны SoundCloud на телефоне нарисованы, но не работают: вход и потоки появятся,
// когда обкатаем ВК. Пока каналы отвечают отказом с понятным текстом.
const SC_OFF = { ok: false, message: 'SoundCloud на телефоне пока не работает — он появится позже', hasKey: false }

export function installBridge(deps: BridgeDeps) {
  const table = new Map<string, (...a: unknown[]) => unknown>()
  const handle: Handle = <C extends Channel>(ch: C, fn: (...a: IpcArgs<C>) => IpcResult<C> | Promise<IpcResult<C>>) => {
    table.set(ch, fn as (...a: unknown[]) => unknown)
  }

  const settings = makeSettings(
    slotFrom<unknown>(deps.store, 'settings', null),
    slotFrom<Record<string, boolean>>(deps.store, 'migrations', {}),
    // своей папки для загрузок на телефоне нет: поле остаётся в типе, но не используется
    (): Settings => defaultSettings('')
  )

  const core: CoreCtx = {
    api: () => deps.api,
    logout: () => void deps.logout(),
    session: deps.session,
    // окна на телефоне нет — кнопки ничего не делают, но канал отвечает
    window: { min: () => {}, max: () => {}, close: () => {} }
  }
  registerCore(core, handle)

  handle('auth:browser', () => deps.login())
  handle('vk:captchaAnswer', (key: string) => { captchaWaiting?.(key); captchaWaiting = null })

  // ── своё, что лежит на телефоне ──────────────────────────
  handle('scl:get', () => deps.store.get<Track[]>('scLikes', []))
  handle('scl:set', (likes: Track[]) => deps.store.set('scLikes', likes))
  handle('lpl:get', () => deps.store.get<LocalPl[]>('localPlaylists', []))
  handle('lpl:set', (list: LocalPl[]) => deps.store.set('localPlaylists', list))
  handle('wave:get', () => deps.store.get<WaveProfile | null>('wave', null))
  handle('wave:set', (p: WaveProfile) => deps.store.set('wave', p))

  handle('settings:get', () => settings.get())
  handle('settings:set', (patch: Partial<Settings>) => settings.set(patch ?? {}))
  handle('settings:pickDir', () => null)

  handle('app:log', (msg: string) => { deps.log?.(msg) })
  handle('discord:update', (u: DiscordUpdate) => { deps.now?.(u) })

  // ── чего на телефоне пока нет ────────────────────────────
  // Каналы обязаны отвечать: окно общее с компьютером и зовёт их не спрашивая.
  handle('sc:search', () => [])
  handle('sc:related', () => [])
  handle('sc:stream', () => '')
  handle('sc:resolve', () => ({ kind: 'playlist' as const, title: 'SoundCloud недоступен', author: '', tracks: [] }))
  handle('sc:suggest', () => [])
  handle('sc:users', () => [])
  handle('sc:searchPlaylists', () => [])
  handle('sc:status', () => SC_OFF)
  handle('sc:prepare', () => SC_OFF)
  handle('sc:waveform', () => [])
  handle('sc:comments', () => [])
  handle('scacc:me', () => null)
  handle('scacc:login', () => null)
  handle('scacc:logout', () => {})
  handle('scacc:likes', () => [])
  handle('scacc:playlists', () => [])
  handle('scacc:playlistTracks', () => [])
  handle('scacc:feed', () => [])
  handle('scacc:like', () => {})

  handle('dl:start', () => {})
  handle('dl:list', () => [])
  handle('dl:cancel', () => {})
  handle('dl:localPath', () => null)
  handle('dl:openFolder', () => {})

  handle('upd:state', () => deps.updates?.get() ?? { status: 'disabled' as const })
  handle('upd:check', () => deps.updates?.check() ?? { status: 'disabled' as const })
  handle('upd:download', () => deps.updates?.download())
  handle('upd:install', () => deps.updates?.install())

  window.api = {
    invoke(channel: string, ...args: unknown[]) {
      if (!isAllowedChannel(channel)) return Promise.reject(new Error('Недоступно'))
      const fn = table.get(channel)
      if (!fn) return Promise.reject(new Error('Недоступно'))
      // ошибки наружу — понятным текстом, тем же friendly, что у компьютера
      return Promise.resolve().then(() => fn(...args)).catch((e) => { throw friendly(e) })
    },
    on(event: string, cb: (payload: unknown) => void) {
      if (!(event in { 'sys:state': 1, 'auth:lost': 1, 'dl:changed': 1, 'tray:cmd': 1, 'vk:captcha': 1, 'upd:changed': 1 })) return () => {}
      const list = listeners.get(event as EventName) ?? []
      list.push(cb)
      listeners.set(event as EventName, list)
      return () => listeners.set(event as EventName, (listeners.get(event as EventName) ?? []).filter((f) => f !== cb))
    }
  } as Window['api']
}
