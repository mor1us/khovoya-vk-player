import { ipcMain, BrowserWindow } from 'electron'
import type { Channel, IpcArgs, IpcResult } from '../../shared/ipc'
import type { AudioApi } from '../vk/audio'
import type { Session } from '../../shared/types'
import { friendly } from '../../shared/friendly'
import { registerCore as registerShared } from '../../shared/channels'

export type Ctx = {
  win: () => BrowserWindow | null
  api: () => AudioApi
  logout: () => void
  session: () => Promise<Session>
}

export { friendly }

export function handle<C extends Channel>(ch: C, fn: (...a: IpcArgs<C>) => IpcResult<C> | Promise<IpcResult<C>>) {
  ipcMain.removeHandler(ch)
  ipcMain.handle(ch, async (_e, ...args) => {
    try { return await fn(...(args as IpcArgs<C>)) } catch (e) { throw friendly(e) }
  })
}

/** Та же таблица, что у телефона (`src/shared/channels.ts`), только кнопки окна настоящие. */
export function registerCore(c: Ctx) {
  registerShared({
    api: c.api,
    logout: c.logout,
    session: c.session,
    window: {
      min: () => c.win()?.minimize(),
      max: () => { const w = c.win(); if (!w) return; if (w.isMaximized()) w.unmaximize(); else w.maximize() },
      close: () => c.win()?.close()
    }
  }, handle)
}
