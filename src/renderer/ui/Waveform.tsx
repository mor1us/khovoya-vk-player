import { useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../../shared/types'
import { stretchBars, waveBars } from './format'

/** Настоящие волны SoundCloud: грузим один раз на трек и помним. */
const realCache = new Map<string, number[]>()

function useRealBars(track: Track | undefined, n: number): number[] | null {
  const key = track ? `${track.id}:${n}` : ''
  const [bars, setBars] = useState<number[] | null>(() => (key ? realCache.get(key) ?? null : null))
  useEffect(() => {
    setBars(key ? realCache.get(key) ?? null : null)
    if (!track || track.src !== 'sc' || !track.wave || realCache.has(key)) return
    let alive = true
    window.api.invoke('sc:waveform', track, n).then((b) => {
      if (!b?.length) return
      realCache.set(key, stretchBars(b))
      if (alive) setBars(realCache.get(key)!)
    }).catch(() => {})
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return bars
}

/** Волна над временем: у треков SoundCloud — настоящая громкость, у остальных — рисунок по id трека. */
export function Waveform({ id, track, progress, onSeek, n = 70, className = 'wf', dragSeek = false }: {
  id: string; track?: Track; progress: number; onSeek: (f: number) => void; n?: number; className?: string; dragSeek?: boolean
}) {
  const fake = useMemo(() => waveBars(id || 'none', n), [id, n])
  const real = useRealBars(track, n)
  const bars = real ?? fake
  const pointer = useRef<number | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const clamp = (f: number) => Math.min(1, Math.max(0, f))
  const positionAt = (element: HTMLDivElement, clientX: number) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 ? clamp((clientX - rect.left) / rect.width) : 0
  }
  const position = clamp(preview ?? progress)
  const cut = Math.round(position * n)
  const stopDrag = (pointerId: number) => {
    if (pointer.current !== pointerId) return false
    pointer.current = null
    setPreview(null)
    return true
  }
  return (
    <div className={className + (real ? ' real' : '')}
      onClick={dragSeek ? undefined : (e) => onSeek(positionAt(e.currentTarget, e.clientX))}
      {...(dragSeek ? {
        role: 'slider', tabIndex: 0, 'aria-label': 'Позиция трека',
        'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(position * 100),
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.button !== 0 || pointer.current !== null) return
          e.currentTarget.setPointerCapture(e.pointerId)
          pointer.current = e.pointerId
          setPreview(positionAt(e.currentTarget, e.clientX))
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          if (pointer.current === e.pointerId) setPreview(positionAt(e.currentTarget, e.clientX))
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
          if (stopDrag(e.pointerId)) onSeek(positionAt(e.currentTarget, e.clientX))
        },
        onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => { stopDrag(e.pointerId) },
        onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => { stopDrag(e.pointerId) },
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          const offsets: Record<string, number> = { ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, Home: -1, End: 1 }
          if (!Object.hasOwn(offsets, e.key)) return
          e.preventDefault()
          onSeek(clamp(position + offsets[e.key]))
        }
      } : {})}>
      {bars.map((h, i) => <i key={i} className={i < cut ? 'p' : ''} style={{ height: `${Math.round(h * 100)}%` }} />)}
    </div>
  )
}
