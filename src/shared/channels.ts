import type { Channel, IpcArgs, IpcResult } from './ipc'
import type { AudioApi } from '../main/vk/audio'
import type { Session, Playlist, Track } from './types'

/**
 * Таблица «канал → что делать», общая для компьютера и телефона.
 * Здесь нет ни Electron, ни Capacitor: как доставлять вызов — решает тот, кто передаёт `handle`.
 * На компьютере это обёртка над `ipcMain` (`src/main/ipc/handlers.ts`),
 * на телефоне — обычный объект (`src/mobile/bridge.ts`).
 */
export type Handle = <C extends Channel>(ch: C, fn: (...a: IpcArgs<C>) => IpcResult<C> | Promise<IpcResult<C>>) => void

export type CoreCtx = {
  api: () => AudioApi
  logout: () => void
  session: () => Promise<Session>
  /** На компьютере — настоящее окно, на телефоне — пустые действия: окна там нет. */
  window: { min(): void; max(): void; close(): void }
}

export function registerCore(c: CoreCtx, handle: Handle) {
  handle('auth:logout', () => c.logout())
  handle('auth:session', () => c.session())

  handle('vk:myTracks', () => c.api().myTracks())
  handle('vk:search', (q: string, off?: number, byDate?: boolean) => c.api().search(q, off, byDate))
  handle('vk:playlists', () => c.api().playlists())
  handle('vk:playlistTracks', (p: Playlist) => c.api().playlistTracks(p))
  handle('vk:recommendations', (t?: string, n?: number) => c.api().recommendations(t, n))
  handle('vk:popular', () => c.api().popular())
  handle('vk:forYou', () => c.api().forYou())
  handle('vk:artistTracks', (a: { id?: string; name: string }) => c.api().artistTracks(a))
  handle('vk:artistInfo', (a: { id?: string; name: string }) => c.api().artistInfo(a))
  handle('vk:artistFollow', (a: { id?: string; name: string }, on: boolean) => c.api().followArtist(a, on))
  handle('vk:byId', (ids: string[]) => c.api().byId(ids))
  handle('vk:add', (t: Track) => c.api().add(t))
  handle('vk:remove', (t: Track) => c.api().remove(t))

  handle('pl:create', (title: string) => c.api().createPlaylist(title))
  handle('pl:edit', (p: Playlist, title: string) => c.api().editPlaylist(p, title))
  handle('pl:addTracks', (p: Playlist, ids: string[]) => c.api().addToPlaylist(p, ids))
  handle('pl:removeTracks', (p: Playlist, ids: string[]) => c.api().removeFromPlaylist(p, ids))
  handle('pl:delete', (p: Playlist) => c.api().deletePlaylist(p))
  handle('pl:reorder', (t: Track, before?: string, after?: string, p?: Playlist) => c.api().reorder(t, before, after, p))

  handle('win:min', () => c.window.min())
  handle('win:max', () => c.window.max())
  handle('win:close', () => c.window.close())
}
