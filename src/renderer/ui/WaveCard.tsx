import { useEffect, useRef } from 'react'
import { useWave } from '../store/wave'
import { useUi } from '../store/ui'
import { usePlayer } from '../store/playerInstance'
import { plural } from './format'
import * as I from './icons'
import type { WaveMode } from '../../shared/types'

const MODES: [WaveMode, string][] = [['mix', 'Микс'], ['new', 'Новое'], ['fav', 'Любимое']]

/** Чёрные линии на зелёной карточке. Останавливаются, когда окно свёрнуто. */
function useLines(ref: React.RefObject<HTMLCanvasElement>) {
  const bg = useUi((s) => s.background)
  useEffect(() => {
    const c = ref.current; if (!c || bg) return
    const x = c.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      const w = (c.width = c.clientWidth * 2), h = (c.height = c.clientHeight * 2)
      x.clearRect(0, 0, w, h); x.strokeStyle = '#0B0B0B'
      for (let k = 0; k < 4; k++) {
        x.beginPath(); x.lineWidth = 2 + k * 0.5
        for (let i = 0; i <= w; i += 8) { const y = h * 0.62 + Math.sin(i / (150 + k * 28) + t / 1400 + k) * (22 + k * 7) + Math.sin(i / 55 + t / 800) * 4 - k * 10; i ? x.lineTo(i, y) : x.moveTo(i, y) }
        x.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [ref, bg])
}

export function WaveCard() {
  const cv = useRef<HTMLCanvasElement>(null)
  useLines(cv)
  const mode = useWave((s) => s.mode)
  const loading = useWave((s) => s.loading)
  const reactions = useWave((s) => s.profile.reactions)
  const inWave = usePlayer((s) => s.source.startsWith('wave:') && s.playing)
  return (
    <div className="box wavec">
      <canvas ref={cv} />
      <div className={'meter' + (inWave ? '' : ' still')}><i style={{ height: 9 }} /><i style={{ height: 20 }} /><i style={{ height: 14 }} /><i style={{ height: 24 }} /></div>
      <div className="k">ПОТОК БЕЗ КОНЦА</div>
      <h2>Волна</h2>
      <p>{reactions ? `Учится на твоих ♥ и пропусках. Уже ${reactions} ${plural(reactions, 'реакция', 'реакции', 'реакций')}.` : 'Лайкай, что зашло, пропускай, что нет — поток подстроится под тебя.'}</p>
      <div className="m">{MODES.map(([m, l]) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => useWave.getState().setMode(m)}>{l}</button>)}</div>
      <button className="go" title="Включить Волну" disabled={loading} onClick={() => void useWave.getState().start().catch((e) => useUi.getState().toast((e as Error).message))}>
        {loading ? <span style={{ font: '700 12px var(--M)' }}>…</span> : <I.IPlay size={24} />}
      </button>
    </div>
  )
}
