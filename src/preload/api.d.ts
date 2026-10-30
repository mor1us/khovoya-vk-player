import type { Channel, EventName } from '../shared/ipc'
declare global {
  interface Window {
    api: {
      invoke<T = unknown>(channel: Channel, ...args: unknown[]): Promise<T>
      on(event: EventName, cb: (payload: any) => void): () => void
    }
  }
}
export {}
