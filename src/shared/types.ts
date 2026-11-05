export type Track = {
  id: string // `${ownerId}_${vkId}`
  ownerId: number
  vkId: number
  accessKey?: string
  title: string
  artist: string
  duration: number
  url: string
  coverUrl?: string
  addedAt?: number
  available: boolean
  /** Основные исполнители из ВК (main_artists), если есть. */
  artists?: { id: string; name: string }[]
  /** Альбом ВК, если трек из альбома. */
  album?: { id: number; ownerId: number; accessKey?: string; title: string }
  /** Откуда трек: нет — ВКонтакте, 'sc' — SoundCloud. */
  src?: 'sc'
  scAuth?: string
  scStream?: string
  /** Все подходящие потоки по порядку — если первый не отдаётся, пробуем следующий. */
  scStreams?: string[]
  link?: string
  /** Ссылка на рисунок громкости SoundCloud. */
  wave?: string
}

export type Playlist = {
  id: number
  ownerId: number
  accessKey?: string
  title: string
  count: number
  coverUrls: string[]
  isMine: boolean
  updatedAt: number
  /** Подпись ВК, например «Вы слушали: …». */
  subtitle?: string
  /** Плейлист Хвои: хранится на компе, в нём могут быть треки ВК и SoundCloud. */
  local?: boolean
  /** Плейлист из аккаунта SoundCloud. */
  sc?: boolean
}

export type Settings = {
  downloadDir: string
  closeToTray: boolean
  animations: boolean
  discordEnabled: boolean
  discordAppId: string
  crossfadeSec: number // 0..12
  /** Комментарии SoundCloud по ходу трека. */
  scComments: boolean
}

export type LoginStep =
  | { kind: 'ok'; userName: string; avatar?: string }
  | { kind: 'error'; message: string }

export type Session = { loggedIn: boolean; userName?: string; avatar?: string; userId?: number }

export type DownloadJob = {
  id: string
  title: string
  artist: string
  status: 'queued' | 'active' | 'done' | 'error' | 'canceled'
  progress: number // 0..1
  path?: string
  error?: string
}

export type WaveMode = 'mix' | 'new' | 'fav'

export type WaveProfile = {
  artists: Record<string, number>
  seeds: string[]
  banned: string[]
  snoozed: Record<string, number>
  reactions: number
  /** Треки с «не нравится» — чтобы можно было посмотреть и вернуть. */
  disliked?: Track[]
  /** Баны и отдыхающие по ключу «артист — название»: копии трека в ВК считаются одной песней. */
  bannedKeys?: string[]
  snoozedKeys?: Record<string, number>
  /** Когда профиль менялся последний раз: от этого стареют веса артистов. */
  at?: number
}

export type DiscordUpdate = { track: Track | null; playing: boolean; position: number }

export type ArtistRef = { id?: string; name: string }

/** SoundCloud: всё, что ходит между окном и главным процессом. */
export type ScMe = { id: number; name: string; avatar?: string }
export type ScPlaylistRef = { id: number; title: string; count: number; cover?: string; link?: string; mine: boolean; author?: string }
export type ScStatus = { ok: boolean; message?: string; hasKey: boolean }
export type ScComment = { at: number; text: string; user: string; avatar?: string }
export type ScArtist = { name: string; avatar?: string; link?: string; followers: number }
export type ScResolved =
  | { kind: 'track'; track: Track }
  | { kind: 'playlist'; title: string; author: string; cover?: string; link?: string; tracks: Track[] }

/** Блок подборок «Для вас» из каталога ВК. */
export type ForYouBlock = { title: string; big: boolean; playlists: Playlist[] }

/** Плейлист Хвои: лежит на компе, в нём могут быть треки ВК и SoundCloud. */
export type LocalPl = { id: number; title: string; tracks: Track[]; updatedAt: number }
