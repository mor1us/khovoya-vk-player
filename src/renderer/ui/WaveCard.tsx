import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWave, kindOf, type WaveKind } from '../store/wave'
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
    if (changed && player.getState().source.startsWith('wave:')) void useWave.getState().startKind(kindOf(player.getState().source)).catch((e) => useUi.getState().toast((e as Error).message))
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

const LOOK: Record<WaveKind, { lines: string[]; k: string; title: string; ring: string }> = {
  vk: { lines: ['#0B0B0B'], k: 'ПОТОК БЕЗ КОНЦА', title: 'Волна', ring: 'ВОЛНА · ПОТОК БЕЗ КОНЦА · ВОЛНА · ПОТОК БЕЗ КОНЦА · ' },
  sc: { lines: ['#FF5500'], k: 'ТОЛЬКО SOUNDCLOUD', title: 'Волна SC', ring: 'SOUNDCLOUD · ВОЛНА · SOUNDCLOUD · ВОЛНА · ' },
  both: { lines: ['#39FF14', '#FF5500'], k: 'ВК + SOUNDCLOUD', title: 'Вместе', ring: 'ВК · SOUNDCLOUD · ВК · SOUNDCLOUD · ВК · SOUNDCLOUD · ' }
}

/** Линии на карточке. Двигаются, только пока играет эта Волна и окно не свёрнуто. */
function useLines(ref: React.RefObject<HTMLCanvasElement>, live: boolean, colors: string[]) {
  const bg = useUi((s) => s.background)
  useEffect(() => {
    const c = ref.current; if (!c || bg) return
    const x = c.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      const w = (c.width = c.clientWidth * 2), h = (c.height = c.clientHeight * 2)
      x.clearRect(0, 0, w, h)
      for (let k = 0; k < 5; k++) {
        x.strokeStyle = colors[k % colors.length]
        x.beginPath(); x.lineWidth = 2 + k * 0.5
        for (let i = 0; i <= w; i += 8) { const y = h * 0.62 + Math.sin(i / (120 + k * 26) + t / 1500 + k) * (16 + k * 7) + Math.sin(i / 50 + t / 900) * 3 - k * 10; i ? x.lineTo(i, y) : x.moveTo(i, y) }
        x.stroke()
      }
      if (live) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [ref, bg, live, colors])
}

/** Одна Волна-колонка: ВК (зелёная), SoundCloud (чёрно-оранжевая) или обе вперемешку. */
function WaveColumn({ kind, onTune }: { kind: WaveKind; onTune: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const look = LOOK[kind]
  const loading = useWave((s) => s.loadingKind === kind)
  const tune = useWave((s) => s.tune)
  const inThis = usePlayer((s) => s.source.startsWith('wave:') && kindOf(s.source) === kind)
  const playing = usePlayer((s) => s.playing)
  const live = inThis && playing
  useLines(cv, live, look.lines)
  const summary = tuneSummary(tune)
  const go = () => {
    if (inThis) { void player.getState().toggle(); return }
    void useWave.getState().startKind(kind).catch((e) => useUi.getState().toast((e as Error).message))
  }
  return (
    <div className={`wcol ${kind}` + (live ? ' live' : '')}>
      <canvas ref={cv} />
      <div className="k">{live ? 'В ЭФИРЕ' : inThis ? 'НА ПАУЗЕ' : look.k}</div>
      <h2>{look.title}</h2>
      <div className="tags">{summary ? summary.split(' · ').map((x) => <span key={x}>{x}</span>) : <span className="soft">под твой вкус</span>}</div>
      <button className="wtune" onClick={onTune} title="Настроить Волну"><I.ITune size={15} /></button>
      <button className="disc" title={live ? 'Пауза' : 'Слушать'} disabled={loading} onClick={go}>
        <svg className="ring" viewBox="0 0 200 200" aria-hidden>
          <defs><path id={`wr-${kind}`} d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" /></defs>
          <text><textPath href={`#wr-${kind}`} textLength="474" lengthAdjust="spacing">{look.ring}</textPath></text>
        </svg>
        <span className="hub">{loading ? <span className="dots"><i /><i /><i /></span> : live ? <I.IPause size={22} /> : <I.IPlay size={24} />}</span>
      </button>
    </div>
  )
}

/** Три Волны колонками. Настройки (настроение, узнаваемость, язык) общие. */
export function WaveCard({ only }: { only?: WaveKind[] } = {}) {
  const [tuning, setTuning] = useState(false)
  const reactions = useWave((s) => s.profile.reactions)
  return (
    <>
      <div className="waves">
        {(only ?? (['vk', 'sc', 'both'] as WaveKind[])).map((k) => <WaveColumn key={k} kind={k} onTune={() => setTuning(true)} />)}
      </div>
      {reactions > 0 && <div className="wavehint">Волны учатся на твоих ♥ и пропусках · {reactions} {plural(reactions, 'реакция', 'реакции', 'реакций')}</div>}
      {tuning && <TuneDialog onClose={() => setTuning(false)} />}
    </>
  )
}
