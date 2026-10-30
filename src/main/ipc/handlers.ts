import { ipcMain, BrowserWindow } from 'electron'
import type { Channel } from '../../shared/ipc'
import type { AudioApi } from '../vk/audio'
import type { LoginInput, LoginStep, Session, Playlist, Track } from '../../shared/types'

export type Ctx = {
  win: () => BrowserWindow | null
  api: () => AudioApi
  login: (i: LoginInput) => Promise<LoginStep>
  logout: () => void
  session: () => Promise<Session>
}

/** Ошибки наружу уходят текстом без кодов. */
function friendly(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  if (/fetch failed|ENOTFOUND|ECONN|network/i.test(msg)) return new Error('Нет подключения')
  return new Error(msg || 'Что-то пошло не так')
}

export function handle(ch: Channel, fn: (...a: any[]) => unknown) {
  ipcMain.removeHandler(ch)
  ipcMain.handle(ch, async (_e, ...args) => {
    try { return await fn(...args) } catch (e) { throw friendly(e) }
  })
}

export function registerCore(c: Ctx) {
  handle('auth:login', (i: LoginInput) => c.login(i))
  handle('auth:logout', () => c.logout())
  handle('auth:session', () => c.session())

  handle('vk:myTracks', () => c.api().myTracks())
  handle('vk:search', (q: string, off?: number) => c.api().search(q, off))
  handle('vk:playlists', () => c.api().playlists())
  handle('vk:playlistTracks', (p: Playlist) => c.api().playlistTracks(p))
  handle('vk:recommendations', (t?: string, n?: number) => c.api().recommendations(t, n))
  handle('vk:popular', () => c.api().popular())
  handle('vk:byId', (ids: string[]) => c.api().byId(ids))
  handle('vk:add', (t: Track) => c.api().add(t))
  handle('vk:remove', (t: Track) => c.api().remove(t))

  handle('pl:create', (title: string) => c.api().createPlaylist(title))
  handle('pl:edit', (p: Playlist, title: string) => c.api().editPlaylist(p, title))
  handle('pl:addTracks', (p: Playlist, ids: string[]) => c.api().addToPlaylist(p, ids))
  handle('pl:removeTracks', (p: Playlist, ids: string[]) => c.api().removeFromPlaylist(p, ids))
  handle('pl:delete', (p: Playlist) => c.api().deletePlaylist(p))
  handle('pl:reorder', (t: Track, before?: string, after?: string, p?: Playlist) => c.api().reorder(t, before, after, p))

  handle('win:min', () => c.win()?.minimize())
  handle('win:close', () => c.win()?.close())
  handle('win:max', () => { const w = c.win(); if (w) w.isMaximized() ? w.unmaximize() : w.maximize() })
}
