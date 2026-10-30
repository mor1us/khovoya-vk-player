import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { isAllowedChannel, isAllowedEvent } from '../shared/ipc'

contextBridge.exposeInMainWorld('api', {
  invoke(channel: string, ...args: unknown[]) {
    if (!isAllowedChannel(channel)) return Promise.reject(new Error('Недоступно'))
    return ipcRenderer.invoke(channel, ...args)
  },
  on(event: string, cb: (payload: unknown) => void) {
    if (!isAllowedEvent(event)) return () => {}
    const h = (_e: IpcRendererEvent, p: unknown) => cb(p)
    ipcRenderer.on(event, h)
    return () => ipcRenderer.removeListener(event, h)
  }
})
