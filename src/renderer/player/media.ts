import type { StoreApi } from 'zustand/vanilla'
import type { PlayerState } from '../store/player'
import { useUi } from '../store/ui'

/** Медиаклавиши и плашка Windows (через Media Session) + горячие клавиши в окне. */
export function bindMedia(p: StoreApi<PlayerState>, focusSearch: () => void) {
  const ms = navigator.mediaSession
  if (ms) {
    ms.setActionHandler('play', () => void p.getState().toggle())
    ms.setActionHandler('pause', () => void p.getState().toggle())
    ms.setActionHandler('previoustrack', () => void p.getState().prev())
    ms.setActionHandler('nexttrack', () => void p.getState().next())
    ms.setActionHandler('seekto', (e) => { if (e.seekTime != null) p.getState().seek(e.seekTime) })
    let lastId = ''
    p.subscribe((s) => {
      ms.playbackState = s.playing ? 'playing' : s.current ? 'paused' : 'none'
      if (s.current && s.current.id !== lastId) {
        lastId = s.current.id
        ms.metadata = new MediaMetadata({
          title: s.current.title, artist: s.current.artist, album: 'Хвоя',
          artwork: s.current.coverUrl && !s.current.coverUrl.startsWith('data:') ? [{ src: s.current.coverUrl, sizes: '600x600' }] : []
        })
      }
    })
  }
  window.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement
    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    if (e.ctrlKey && e.code === 'KeyF') { e.preventDefault(); focusSearch(); return }
    // F5 и Ctrl+R — как в браузере: перечитать всё с нуля, когда данные протухли или что-то залипло
    if (e.code === 'F5' || (e.ctrlKey && e.code === 'KeyR')) { e.preventDefault(); location.reload(); return }
    if (e.altKey && e.code === 'ArrowLeft') { e.preventDefault(); useUi.getState().back(); return }
    if (e.altKey && e.code === 'ArrowRight') { e.preventDefault(); useUi.getState().forward(); return }
    if (typing) return
    const s = p.getState()
    switch (e.code) {
      case 'Space': e.preventDefault(); void s.toggle(); break
      case 'ArrowLeft': s.seek(Math.max(0, s.position - 5)); break
      case 'ArrowRight': s.seek(s.position + 5); break
      case 'ArrowUp': e.preventDefault(); s.setVolume(s.volume + 0.05); break
      case 'ArrowDown': e.preventDefault(); s.setVolume(s.volume - 0.05); break
    }
  })
  // боковые кнопки мыши (3 — назад, 4 — вперёд): окно не браузер, само их не обработает
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 3 && e.button !== 4) return
    e.preventDefault()
    if (e.button === 3) useUi.getState().back(); else useUi.getState().forward()
  })
  // Windows иначе показывает своё меню навигации поверх окна
  window.addEventListener('mousedown', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault() })
  window.addEventListener('auxclick', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault() })
}
