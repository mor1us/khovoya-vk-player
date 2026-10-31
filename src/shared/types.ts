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
}

export type Settings = {
  downloadDir: string
  closeToTray: boolean
  animations: boolean
  discordEnabled: boolean
  discordAppId: string
  crossfadeSec: number // 0..12
}

export type LoginStep =
  | { kind: 'ok'; userName: string; avatar?: string }
  | { kind: '2fa'; phoneMask?: string; validationSid?: string }
  | { kind: 'captcha'; sid: string; imageDataUrl: string }
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
}

export type SysState = { background: boolean }

export type DiscordUpdate = { track: Track | null; playing: boolean; position: number }

export type ArtistRef = { id?: string; name: string }
