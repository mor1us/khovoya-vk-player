import { useEffect, useState } from 'react'

type Tip = { text: string; x: number; y: number; below: boolean }

/**
 * Своя подсказка вместо системной: системная белая, с чужим шрифтом и не в стиле Хвои.
 * Десятки `title=` по коду не трогаем — забираем их прямо в разметке: как только элемент с title
 * появился (или React переписал его), title переезжает в `data-tip`, и системной всплывать нечему.
 */
function steal(root: ParentNode) {
  const all: Element[] = []
  if (root instanceof Element && root.hasAttribute('title')) all.push(root)
  root.querySelectorAll?.('[title]').forEach((el) => all.push(el))
  for (const el of all) {
    const text = el.getAttribute('title')?.trim()
    el.removeAttribute('title')
    // подсказка нужна там, где словами не написано: если title повторяет надпись — молчим
    if (!text || text === el.textContent?.trim()) continue
    ;(el as HTMLElement).dataset.tip = text
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text) // для чтения с экрана
  }
}

export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null)
  useEffect(() => {
    steal(document.body)
    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'attributes') { if ((r.target as Element).hasAttribute('title')) steal(r.target as Element) }
        else r.addedNodes.forEach((n) => { if (n.nodeType === 1) steal(n as Element) })
      }
    })
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })

    let host: HTMLElement | null = null
    let timer = 0
    const hide = () => { window.clearTimeout(timer); host = null; setTip(null) }
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null
      if (el === host) return
      hide()
      const text = el?.dataset.tip
      if (!el || !text) return
      host = el
      timer = window.setTimeout(() => {
        const r = el.getBoundingClientRect()
        if (!r.width && !r.height) return
        const below = r.top < 96 // у верхнего края окна подсказка уходит вниз, иначе обрежется
        setTip({ text, x: Math.round(r.left + r.width / 2), y: Math.round(below ? r.bottom + 8 : r.top - 8), below })
      }, 350)
    }
    window.addEventListener('mouseover', over, true)
    window.addEventListener('mousedown', hide, true)
    window.addEventListener('wheel', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      mo.disconnect(); hide()
      window.removeEventListener('mouseover', over, true)
      window.removeEventListener('mousedown', hide, true)
      window.removeEventListener('wheel', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])
  if (!tip) return null
  const x = Math.min(Math.max(tip.x, 150), window.innerWidth - 150)
  return <div className="tip" style={{ left: x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}>{tip.text}</div>
}
