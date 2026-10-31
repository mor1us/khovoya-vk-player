import { create } from 'zustand'
import type { UpdateState } from '../../shared/updates'

export const useUpdates = create<{ s: UpdateState; hidden: boolean; hide(): void }>((set) => ({ s: { status: 'idle' }, hidden: false, hide: () => set({ hidden: true }) }))

let bound = false
export function bindUpdates() {
  if (bound) return
  bound = true
  window.api.invoke<UpdateState>('upd:state').then((s) => useUpdates.setState({ s })).catch(() => {})
  window.api.on('upd:changed', (s: UpdateState) => useUpdates.setState({ s, hidden: s.status === 'ready' || s.status === 'available' ? false : useUpdates.getState().hidden }))
}
