import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWave } from '../store/wave'
import { useUi } from '../store/ui'
import { usePlayer, player } from '../store/playerInstance'
import { plural } from './format'
import * as I from './icons'
import { EMPTY_TUNE, LANGS, MOODS, RECOGS, tuneSummary, type WaveTune } from '../wave/tune'

function Chips<K extends string>({ title, items, value, onPick }: { title: string; items: [K, string][]; value: K | null; onPick: (k: K | null) => void }) {
  return (
    <div className="tgrp">
      <div className="tlab">{title}</div>
      <div className="tchips">{items.map(([k, l]) => <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onPick(value === k ? null : k)}>{l}</button>)}</div>
    </div>
  )
}

function TuneDialog({ onClose }: { onClose: () => void }) {
  const [t, setT] = useState<WaveTune>(useWave.getState().tune)
  const apply = () => {
    const changed = JSON.stringify(t) !== JSON.stringify(useWave.getState().tune)
    useWave.getState().setTune(t)
    onClose()
    // Волна уже играет — сразу перезапускаем её под новые настройки
    if (changed && player.getState().source.startsWith('wave:')) void useWave.getState().start().catch((e) => useUi.getState().toast((e as Error).message))
  }
  return createPortal(
    <div className="modal" style={{ position: 'fixed' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="box tune">
        <button className="x" title="Закрыть" onClick={onClose}><I.IX size={16} /></button>
        <div className="tk">ВОЛНА / НАСТРОЙКА</div>
        <h3>Какой поток включить?</h3>
        <Chips title="Настроение" items={MOODS} value={t.mood} onPick={(mood) => setT({ ...t, mood })} />
        <Chips title="Узнаваемость" items={RECOGS} value={t.recog} onPick={(recog) => setT({ ...t, recog })} />
        <Chips title="Язык" items={LANGS} value={t.lang} onPick={(lang) => setT({ ...t, lang })} />
        <div className="ta">
          <button className="btn-s" onClick={() => setT(EMPTY_TUNE)}>Сбросить</button>
          <button className="btn-s g" autoFocus onClick={apply}>Применить</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Чёрные линии на зелёной плашке. Двигаются, только пока играет Волна и окно не свёрнуто. */
function useLines(ref: React.RefObject<HTMLCanvasElement>, live: boolean) {
  const bg = useUi((s) => s.background)
  useEffect(() => {
    const c = ref.current; if (!c || bg) return
    const x = c.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      const w = (c.width = c.clientWidth * 2), h = (c.height = c.clientHeight * 2)
      x.clearRect(0, 0, w, h); x.strokeStyle = '#0B0B0B'
      for (let k = 0; k < 5; k++) {
        x.beginPath(); x.lineWidth = 2 + k * 0.6
        for (let i = 0; i <= w; i += 8) { const y = h * 0.62 + Math.sin(i / (170 + k * 30) + t / 1500 + k) * (20 + k * 8) + Math.sin(i / 60 + t / 900) * 4 - k * 12; i ? x.lineTo(i, y) : x.moveTo(i, y) }
        x.stroke()
      }
      if (live) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [ref, bg, live])
}

/** Большая плашка Волны: зелёная, с линиями, кнопка — крутящийся диск с надписью по кругу. */
export function WaveCard() {
  const [tuning, setTuning] = useState(false)
  const cv = useRef<HTMLCanvasElement>(null)
  const loading = useWave((s) => s.loading)
  const tune = useWave((s) => s.tune)
  const reactions = useWave((s) => s.profile.reactions)
  const inWave = usePlayer((s) => s.source.startsWith('wave:'))
  const playing = usePlayer((s) => s.playing)
  const live = inWave && playing
  useLines(cv, live)
  const summary = tuneSummary(tune)
  const go = () => {
    if (inWave) { void player.getState().toggle(); return }
    void useWave.getState().start().catch((e) => useUi.getState().toast((e as Error).message))
  }
  return (
    <div className={'waveb' + (live ? ' live' : '')}>
      <canvas ref={cv} />
      <div className="wl">
        <div className="k">{live ? 'В ЭФИРЕ' : inWave ? 'НА ПАУЗЕ' : 'ПОТОК БЕЗ КОНЦА'}</div>
        <h2>Волна</h2>
        <div className="tags">
          {summary ? summary.split(' · ').map((s) => <span key={s}>{s}</span>) : <span className="soft">под твой вкус</span>}
        </div>
        <p>{reactions ? `Учится на твоих ♥ и пропусках · ${reactions} ${plural(reactions, 'реакция', 'реакции', 'реакций')}` : 'Лайкай, что зашло, пропускай, что нет — поток подстроится.'}</p>
        <button className="wtune" onClick={() => setTuning(true)}><I.ITune size={16} />Настроить</button>
      </div>
      <button className="disc" title={live ? 'Пауза' : 'Слушать Волну'} disabled={loading} onClick={go}>
        <svg className="ring" viewBox="0 0 200 200" aria-hidden>
          <defs><path id="wring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
          <text><textPath href="#wring" textLength="486" lengthAdjust="spacing">ВОЛНА · ПОТОК БЕЗ КОНЦА · ВОЛНА · ПОТОК БЕЗ КОНЦА · </textPath></text>
        </svg>
        <span className="hub">{loading ? <span className="dots"><i /><i /><i /></span> : live ? <I.IPause size={26} /> : <I.IPlay size={28} />}</span>
      </button>
      {tuning && <TuneDialog onClose={() => setTuning(false)} />}
    </div>
  )
}
