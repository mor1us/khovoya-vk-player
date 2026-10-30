import type { Settings } from '../../shared/types'
import { playerHooks } from './playerInstance'

export function applySettings(s: Settings) {
  playerHooks.crossfadeSec = s.crossfadeSec
  document.documentElement.classList.toggle('no-anim', !s.animations)
}
