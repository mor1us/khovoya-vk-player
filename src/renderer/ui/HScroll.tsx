import { useCallback, useEffect, useRef, useState } from 'react'

/** Горизонтальный ряд карточек: листается стрелками ‹ › и колёсиком мыши. */
export function useHScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [can, setCan] = useState({ l: false, r: false })
  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCan({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    // колёсико: пока ряду есть куда листать — листаем его, на краю отдаём прокрутку странице
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return
      const atStart = el.scrollLeft <= 0, atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update); ro.observe(el)
    const mo = new MutationObserver(update); mo.observe(el, { childList: true })
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect() }
  }, [update])
  const page = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  return { ref, can, page }
}

export function Arrows({ s }: { s: { can: { l: boolean; r: boolean }; page: (d: -1 | 1) => void } }) {
  if (!s.can.l && !s.can.r) return null
  return (
    <span className="arrows">
      <button disabled={!s.can.l} title="Назад" onClick={() => s.page(-1)}>‹</button>
      <button disabled={!s.can.r} title="Дальше" onClick={() => s.page(1)}>›</button>
    </span>
  )
}
