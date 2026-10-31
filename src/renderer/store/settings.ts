import { create } from 'zustand'
import type { Settings } from '../../shared/types'
import { playerHooks } from './playerInstance'

/** Текущие настройки для частей интерфейса, которым они нужны (например, комментарии SoundCloud). */
export const useSettings = create<{ settings: Settings | null }>(() => ({ settings: null }))

export function applySettings(s: Settings) {
  useSettings.setState({ settings: s })
  playerHooks.crossfadeSec = s.crossfadeSec
  document.documentElement.classList.toggle('no-anim', !s.animations)
}
