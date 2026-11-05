import type { Channel, EventMap, EventName, IpcArgs, IpcResult } from '../shared/ipc'

declare global {
  interface Window {
    api: {
      /** Аргументы и тип результата берутся из `IpcMap` — писать их руками больше не нужно. */
      invoke<C extends Channel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResult<C>>
      /** Возвращает отписку. */
      on<E extends EventName>(event: E, cb: (payload: EventMap[E]) => void): () => void
    }
  }
}
export {}
