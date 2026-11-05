import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'
import { useSettings } from '../store/settings'

import { commentAt, type C } from './commentAt'
const cache = new Map<string, C[]>()

/** Комментарии SoundCloud по ходу трека — всплывают над волной, как на сайте. Выключаются в настройках. */
export function ScComments({ track, pos }: { track: Track; pos: number }) {
  const on = useSettings((s) => s.settings?.scComments ?? true)
  const [list, setList] = useState<C[]>([])
  useEffect(() => {
    setList(cache.get(track.id) ?? [])
    if (!on || track.src !== 'sc' || cache.has(track.id)) return
    let alive = true
    window.api.invoke('sc:comments', track).then((c) => { cache.set(track.id, c ?? []); if (alive) setList(c ?? []) }).catch(() => {})
    return () => { alive = false }
  }, [track.id, on]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on || track.src !== 'sc') return null
  const c = commentAt(list, pos)
  return (
    <div className="sccom nodrag" aria-live="polite">
      {c && <div className="bubble" key={c.at + c.user}><b>{c.user}</b>{c.text}</div>}
    </div>
  )
}
