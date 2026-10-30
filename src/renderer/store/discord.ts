import { player } from './playerInstance'

/** Шлём статус только при смене трека, паузе или перемотке — без постоянного опроса. */
export function bindDiscord() {
  let lastId: string | null = null, lastPlaying = false, lastPos = 0
  const send = () => {
    const s = player.getState()
    void window.api.invoke('discord:update', { track: s.current, playing: s.playing, position: s.position }).catch(() => {})
  }
  player.subscribe((s) => {
    const id = s.current?.id ?? null
    const jumped = Math.abs(s.position - lastPos) > 3
    lastPos = s.position
    if (id !== lastId || s.playing !== lastPlaying || jumped) { lastId = id; lastPlaying = s.playing; send() }
  })
}
