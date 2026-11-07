import type {
  ArtistRef, DiscordUpdate, DownloadJob, ForYouBlock, LocalPl, LoginStep, Playlist, ScArtist, ScComment,
  ScMe, ScPlaylistRef, ScResolved, ScStatus, Session, Settings, Track, WaveProfile
} from './types'
import type { UpdateState } from './updates'

/**
 * Договор между окном и главным процессом: канал → какие аргументы принимает и что возвращает.
 * Это единственное место, где он описан: `handle()` в главном процессе и `window.api.invoke()`
 * в окне берут типы отсюда, поэтому разойтись они больше не могут — ошибку покажет typecheck.
 * Новый канал = строка здесь + строка в `IPC` ниже (мост пропускает только то, что есть в `IPC`).
 */
export type IpcMap = {
  // вход в ВК
  'auth:browser': () => LoginStep
  'auth:logout': () => void
  'auth:session': () => Session

  // музыка ВК
  'vk:myTracks': () => Track[]
  'vk:search': (q: string, offset?: number, byDate?: boolean) => { tracks: Track[]; playlists: Playlist[] }
  'vk:playlists': () => Playlist[]
  'vk:playlistTracks': (p: Playlist) => Track[]
  'vk:recommendations': (target?: string, count?: number) => Track[]
  'vk:popular': () => Track[]
  'vk:forYou': () => ForYouBlock[]
  'vk:artistTracks': (a: ArtistRef) => Track[]
  'vk:byId': (ids: string[]) => Track[]
  'vk:add': (t: Track) => void
  'vk:remove': (t: Track) => void
  /** Ответ на капчу: канал живёт только пока ВК её спрашивает. */
  'vk:captchaAnswer': (key: string) => void

  // плейлисты ВК
  'pl:create': (title: string) => Playlist
  'pl:edit': (p: Playlist, title: string) => void
  'pl:addTracks': (p: Playlist, ids: string[]) => void
  'pl:removeTracks': (p: Playlist, ids: string[]) => void
  'pl:delete': (p: Playlist) => void
  'pl:reorder': (t: Track, before?: string, after?: string, p?: Playlist) => void

  // SoundCloud без входа
  'sc:search': (q: string) => Track[]
  'sc:related': (t: Track) => Track[]
  /** Ссылка на поток живёт недолго — берётся прямо перед прослушиванием. */
  'sc:stream': (t: Track) => string
  'sc:resolve': (url: string) => ScResolved
  'sc:suggest': (q: string) => string[]
  'sc:users': (q: string) => ScArtist[]
  'sc:searchPlaylists': (q: string) => ScPlaylistRef[]
  'sc:status': () => ScStatus
  'sc:prepare': () => ScStatus
  'sc:waveform': (t: Track, n?: number) => number[]
  'sc:comments': (t: Track) => ScComment[]

  // аккаунт SoundCloud
  'scacc:me': () => ScMe | null
  'scacc:login': () => ScMe | null
  'scacc:logout': () => void
  'scacc:likes': () => Track[]
  'scacc:playlists': () => ScPlaylistRef[]
  'scacc:playlistTracks': (id: number) => Track[]
  'scacc:feed': () => Track[]
  'scacc:like': (t: Track, on: boolean) => void

  // своё, что хранится на компе
  'scl:get': () => Track[]
  'scl:set': (likes: Track[]) => void
  'lpl:get': () => LocalPl[]
  'lpl:set': (list: LocalPl[]) => void
  'wave:get': () => WaveProfile | null
  'wave:set': (profile: WaveProfile) => void

  // загрузки
  'dl:start': (tracks: Track[]) => void
  'dl:list': () => DownloadJob[]
  'dl:cancel': (id: string) => void
  /** Адрес скачанного файла (khvoya-media://…) или null, если его нет. */
  'dl:localPath': (id: string) => string | null
  'dl:openFolder': (id?: string) => void

  // настройки, окно, журнал
  'settings:get': () => Settings
  'settings:set': (patch: Partial<Settings>) => Settings
  'settings:pickDir': () => string | null
  'win:min': () => void
  'win:max': () => void
  'win:close': () => void
  'app:log': (msg: string) => void
  'discord:update': (u: DiscordUpdate) => void

  // обновления
  'upd:state': () => UpdateState
  'upd:check': () => UpdateState
  'upd:download': () => void
  'upd:install': () => void
}

export type Channel = keyof IpcMap
export type IpcArgs<C extends Channel> = Parameters<IpcMap[C]>
export type IpcResult<C extends Channel> = Awaited<ReturnType<IpcMap[C]>>

/** Что пропускает мост (`src/preload/index.ts`). Всё, чего здесь нет, окно даже не отправит. */
export const IPC = {
  'auth:browser': true, 'auth:logout': true, 'auth:session': true,
  'vk:myTracks': true, 'vk:search': true, 'vk:playlists': true, 'vk:playlistTracks': true,
  'vk:recommendations': true, 'vk:popular': true, 'vk:forYou': true, 'vk:artistTracks': true, 'vk:byId': true, 'vk:add': true, 'vk:remove': true,
  'vk:captchaAnswer': true,
  'pl:create': true, 'pl:edit': true, 'pl:addTracks': true, 'pl:removeTracks': true, 'pl:delete': true, 'pl:reorder': true,
  'sc:search': true, 'sc:related': true, 'sc:stream': true, 'sc:resolve': true, 'sc:suggest': true, 'sc:users': true, 'sc:searchPlaylists': true, 'sc:status': true, 'sc:prepare': true,
  'sc:waveform': true, 'sc:comments': true,
  'scacc:me': true, 'scacc:login': true, 'scacc:logout': true, 'scacc:likes': true, 'scacc:playlists': true, 'scacc:playlistTracks': true, 'scacc:feed': true, 'scacc:like': true,
  'scl:get': true, 'scl:set': true, 'lpl:get': true, 'lpl:set': true,
  'wave:get': true, 'wave:set': true,
  'dl:start': true, 'dl:list': true, 'dl:cancel': true, 'dl:localPath': true, 'dl:openFolder': true,
  'settings:get': true, 'settings:set': true, 'settings:pickDir': true,
  'win:min': true, 'win:max': true, 'win:close': true,
  'app:log': true, 'discord:update': true,
  'upd:state': true, 'upd:check': true, 'upd:download': true, 'upd:install': true
} as const

/** События из главного процесса в окно: имя → что приходит в payload. */
export type EventMap = {
  'sys:state': { background: boolean }
  'auth:lost': undefined
  'dl:changed': undefined
  'tray:cmd': 'toggle' | 'next'
  'vk:captcha': { sid: string; imageDataUrl: string }
  'vk:captchaDone': undefined
  'upd:changed': UpdateState
}

export const EVENTS = { 'sys:state': true, 'auth:lost': true, 'dl:changed': true, 'tray:cmd': true, 'vk:captcha': true, 'vk:captchaDone': true, 'upd:changed': true } as const

export type EventName = keyof EventMap

/**
 * Защита от расхождения списков: если канал есть в `IpcMap`, но забыт в `IPC` (или наоборот),
 * здесь будет ошибка типов с именем канала.
 */
type Expect<T extends never> = T
export type _ChannelMissingInIpc = Expect<Exclude<keyof IpcMap, keyof typeof IPC>>
export type _ChannelMissingInMap = Expect<Exclude<keyof typeof IPC, keyof IpcMap>>
export type _EventMissingInEvents = Expect<Exclude<keyof EventMap, keyof typeof EVENTS>>
export type _EventMissingInMap = Expect<Exclude<keyof typeof EVENTS, keyof EventMap>>

export function isAllowedChannel(c: unknown): c is Channel {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(IPC, c)
}
export function isAllowedEvent(c: unknown): c is EventName {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, c)
}
