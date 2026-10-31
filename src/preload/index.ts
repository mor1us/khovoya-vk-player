import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { isAllowedChannel, isAllowedEvent } from '../shared/ipc'

contextBridge.exposeInMainWorld('api', {
  invoke(channel: string, ...args: unknown[]) {
    if (!isAllowedChannel(channel)) return Promise.reject(new Error('Недоступно'))
    // Electron добавляет к ошибке «Error invoking remote method …» — оставляем только понятный текст
    return ipcRenderer.invoke(channel, ...args).catch((e: Error) => { throw new Error(String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')) })
  },
  on(event: string, cb: (payload: unknown) => void) {
    if (!isAllowedEvent(event)) return () => {}
    const h = (_e: IpcRendererEvent, p: unknown) => cb(p)
    ipcRenderer.on(event, h)
    return () => ipcRenderer.removeListener(event, h)
  }
})
