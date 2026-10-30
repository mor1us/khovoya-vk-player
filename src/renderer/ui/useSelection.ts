import { useCallback, useState } from 'react'
import type { Track } from '../../shared/types'

/** Выделение треков: клик — один, Ctrl — добавить, Shift — диапазон. */
export function useSelection(list: Track[]) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const onSelect = useCallback((t: Track, e: React.MouseEvent) => {
    setSel((prev) => {
      if (e.shiftKey && anchor) {
        const a = list.findIndex((x) => x.id === anchor), b = list.findIndex((x) => x.id === t.id)
        const [lo, hi] = a < b ? [a, b] : [b, a]
        return new Set(list.slice(lo, hi + 1).map((x) => x.id))
      }
      if (e.ctrlKey) { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n }
      return new Set([t.id])
    })
    if (!e.shiftKey) setAnchor(t.id)
  }, [list, anchor])
  const selected = list.filter((t) => sel.has(t.id))
  return { sel, selected, onSelect, clear: () => setSel(new Set()) }
}
