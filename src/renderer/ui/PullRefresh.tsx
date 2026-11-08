import { useEffect, useState } from 'react'
import * as I from './icons'

const NEED = 110 // сколько надо протянуть, чтобы обновить
const MAX = 150

/** Ближайший предок, который и правда прокручивается: страница или список внутри неё. */
function scroller(el: EventTarget | null): HTMLElement | null {
  let n = el as HTMLElement | null
  while (n && n !== document.body) {
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n
    n = n.parentElement
  }
  return null
}

/**
 * Потянуть страницу вниз, когда она и так наверху, — и она перечитается целиком.
 * То же, что F5, только пальцем или колесом: привычный жест из телефонных приложений.
 */
export function PullRefresh() {
  const [pull, setPull] = useState(0)
  useEffect(() => {
    let at = 0
    let touch = -1
    let timer: ReturnType<typeof setTimeout> | null = null
    const atTop = (e: Event) => { const s = scroller(e.target); return !s || s.scrollTop <= 0 }
    const grow = (by: number) => {
      at = Math.min(MAX, at + by)
      setPull(at)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { at = 0; setPull(0) }, 400) // отпустил — пружина назад
      if (at >= NEED) { at = 0; setPull(0); location.reload() }
    }
    const onWheel = (e: WheelEvent) => { if (e.deltaY < 0 && atTop(e)) grow(-e.deltaY / 3) }
    const onStart = (e: TouchEvent) => { touch = atTop(e) ? e.touches[0].clientY : -1 }
    const onMove = (e: TouchEvent) => {
      if (touch < 0) return
      const d = e.touches[0].clientY - touch
      if (d > 0) grow(d / 8)
    }
    const stop = () => { touch = -1 }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', stop)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', stop)
    }
  }, [])
  if (pull < 12) return null
  return (
    <div className="pullr" style={{ transform: `translate(-50%, ${Math.min(pull, MAX) / 2.2}px)`, opacity: Math.min(1, pull / NEED) }}>
      <span style={{ transform: `rotate(${pull * 3}deg)`, display: 'grid' }}><I.IRefresh size={16} /></span>
      {pull >= NEED * 0.9 ? 'Отпусти — обновлю' : 'Потяни, чтобы обновить'}
    </div>
  )
}
