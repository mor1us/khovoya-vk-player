import { useCallback, useEffect, useState } from 'react'

/**
 * Горизонтальный ряд карточек: листается стрелками ‹ › и колёсиком мыши.
 * Ссылка на ряд — колбэк, а не useRef: ряд с результатами поиска появляется позже,
 * чем страница, и обычный ref к моменту useEffect ещё пустой — тогда слушатели не вешались вовсе.
 */
export function useHScroll<T extends HTMLElement = HTMLDivElement>() {
  const [el, setEl] = useState<T | null>(null)
  const ref = useCallback((node: T | null) => setEl(node), [])
  const [can, setCan] = useState({ l: false, r: false })
  useEffect(() => {
    if (!el) return
    const update = () => setCan({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    update()
    // колёсико над рядом листает страницу, а не ряд: иначе страница встаёт намёртво,
    // пока курсор над карточками. Ряд — стрелками ‹ › или Shift+колесо.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return
      if (e.shiftKey) { e.preventDefault(); el.scrollLeft += e.deltaY; return }
      const page = el.closest('.pagescroll, .page')
      if (!page) return
      e.preventDefault()
      page.scrollTop += e.deltaY
    }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update); ro.observe(el)
    const mo = new MutationObserver(update); mo.observe(el, { childList: true, subtree: true })
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect() }
  }, [el])
  const page = (dir: -1 | 1) => el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
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
