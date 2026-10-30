import { usePlayer, player } from '../store/playerInstance'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { useWave } from '../store/wave'
import { Cover } from './Cover'
import { Waveform } from './Waveform'
import { fmtTime } from './format'
import { sourceLabel } from './source'
import { playerHooks } from '../store/playerInstance'
import * as I from './icons'

export function usePosition(): number {
  const bg = useUi((s) => s.background)
  return usePlayer((s) => (bg ? 0 : Math.floor(s.position * 2) / 2))
}

export function Controls({ compact = false }: { compact?: boolean }) {
  const playing = usePlayer((s) => s.playing)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const p = player.getState()
  return (
    <div className="mid">
      {!compact && <button className={'ic' + (shuffle ? ' on' : '')} title="Перемешать" onClick={() => player.getState().toggleShuffle()}><I.IShuffle size={18} /></button>}
      <button className="ic" title="Назад" onClick={() => void p.prev()}><I.IPrev size={22} /></button>
      <button className="play" title={playing ? 'Пауза' : 'Играть'} onClick={() => void player.getState().toggle()}>{playing ? <I.IPause size={24} /> : <I.IPlay size={24} />}</button>
      <button className="ic" title="Вперёд" onClick={() => void p.next()}><I.INext size={22} /></button>
      {!compact && <button className={'ic' + (repeat !== 'off' ? ' on' : '')} title={repeat === 'one' ? 'Повтор трека' : repeat === 'all' ? 'Повтор списка' : 'Повтор выключен'} onClick={() => player.getState().cycleRepeat()}>{repeat === 'one' ? <I.IRepeatOne size={18} /> : <I.IRepeat size={18} />}</button>}
    </div>
  )
}

export function Reactions() {
  const cur = usePlayer((s) => s.current)
  const mine = useLibrary((s) => (cur ? s.mine.some((t) => t.id === cur.id) : false))
  if (!cur) return <div className="react" />
  return (
    <div className="react">
      <button className={'pill' + (mine ? ' on' : '')} onClick={() => void useWave.getState().like(cur).catch((e) => useUi.getState().toast(e.message))}>{mine ? '♥ В моей' : '♥ В мою'}</button>
      <button className="pill" title="Не то — больше не предлагать" onClick={() => void useWave.getState().dislike(cur)}>👎 Не то</button>
    </div>
  )
}

export function Stage() {
  const cur = usePlayer((s) => s.current)
  const source = usePlayer((s) => s.source)
  const duration = usePlayer((s) => s.duration)
  const volume = usePlayer((s) => s.volume)
  const pos = usePosition()
  const dur = duration || cur?.duration || 0
  return (
    <section className="stage drag">
      <div className="top"><div className="brand"><i />ХВОЯ</div>{source && <div className="src">Играет из · <b>{sourceLabel(source)}</b></div>}</div>
      {!cur ? (
        <div className="empty">Ничего не играет.<br />Включи Волну или любой трек справа.</div>
      ) : (
        <>
          <Cover className="cover nodrag" url={cur.coverUrl} seed={cur.id} />
          <div className="title" title={cur.title}>{cur.title}</div>
          <div className="artist"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.artist}</span><span className="chip">{fmtTime(cur.duration)}</span></div>
          <Waveform id={cur.id} progress={dur ? pos / dur : 0} onSeek={(f) => player.getState().seek(f * dur)} className="wf nodrag" />
          <div className="times"><span>{fmtTime(pos)}</span><b>{playerHooks.crossfadeSec ? `⤨ кроссфейд ${playerHooks.crossfadeSec} с` : 'без кроссфейда'}</b><span>{fmtTime(dur)}</span></div>
          <div className="ctl nodrag"><Reactions /><Controls /></div>
          <div className="vol nodrag">
            <button className="ic" onClick={() => player.getState().setVolume(volume > 0 ? 0 : 0.8)} title="Звук">{volume > 0 ? <I.IVol size={18} /> : <I.IMute size={18} />}</button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => player.getState().setVolume(+e.target.value)} />
          </div>
        </>
      )}
    </section>
  )
}

export function MiniBar() {
  const cur = usePlayer((s) => s.current)
  const duration = usePlayer((s) => s.duration)
  const pos = usePosition()
  const dur = duration || cur?.duration || 0
  return (
    <div className="minibar">
      <div className="now">{cur && <><Cover className="cv" url={cur.coverUrl} seed={cur.id} /><div style={{ minWidth: 0 }}><div className="tt">{cur.title}</div><div className="ar">{cur.artist}</div></div></>}</div>
      <Controls compact />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
        {cur && <><span className="muted" style={{ font: '500 11px var(--M)' }}>{fmtTime(pos)}</span><Waveform id={cur.id} n={50} progress={dur ? pos / dur : 0} onSeek={(f) => player.getState().seek(f * dur)} /></>}
      </div>
    </div>
  )
}
