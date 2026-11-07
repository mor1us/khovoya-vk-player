import type { Playlist } from '../../shared/types'
import { useUi } from './ui'
import { readJson, writeJson } from './json'

/** Запоминаем, какой плейлист играет, чтобы из очереди можно было в него перейти. */
let lastPl: Playlist | null = readJson<Playlist | null>('srcPl', null)

export function rememberPlaylist(p: Playlist) {
  lastPl = p
  writeJson('srcPl', p)
}

/** Переход к тому, откуда играет музыка. false — переходить некуда. */
export function canOpenSource(src: string): boolean {
  return !!src && (src.startsWith('sc:') || !(src.startsWith('pl:') && (!lastPl || src.slice(3) !== lastPl.title)))
}

export function openSource(src: string) {
  const ui = useUi.getState()
  if (src.startsWith('sc:')) return ui.go('soundcloud')
  if (src.startsWith('pl:')) { if (lastPl && src.slice(3) === lastPl.title) ui.openPlaylist(lastPl); return }
  if (src === 'mine') return ui.go('mine')
  if (src === 'similar') return ui.go('similar')
  if (src === 'downloads') return ui.go('downloads')
  if (src === 'history') return ui.go('history')
  if (src.startsWith('search:')) return ui.submit(src.slice(7))
  if (src.startsWith('artist:')) return ui.submit(src.slice(7))
  ui.go('home') // Волна и миксы живут на главной
}
