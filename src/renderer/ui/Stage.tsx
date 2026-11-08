import { create } from 'zustand'
import { useEffect, useState } from 'react'
import { usePlayer, player } from '../store/playerInstance'
import { useUi } from '../store/ui'
import { Artists } from './Artists'
import { useLibrary } from '../store/library'
import { useWave } from '../store/wave'
import { useSc } from '../store/sc'
import { Cover } from './Cover'
import { Waveform } from './Waveform'
import { ScComments } from './ScComments'
import { fmtTime } from './format'
import { sourceLabel } from './source'
import { playerHooks } from '../store/playerInstance'
import * as I from './icons'
import { openTrackMenu } from './TrackMenu'
import { SrcBadge } from './TrackRow'

export function usePosition(): number {
  const bg = useUi((s) => s.background)
  return usePlayer((s) => (bg ? 0 : Math.floor(s.position * 2) / 2))
}

/** Сердечко и «не то» по краям кнопок, как в Яндекс Музыке. */
export function LikeBtn() {
  const cur = usePlayer((s) => s.current)
  const inMine = useLibrary((s) => (cur && cur.src !== 'sc' ? s.mine.some((t) => t.id === cur.id) : false))
  const scLiked = useSc((s) => (cur?.src === 'sc' ? s.likes.some((t) => t.id === cur.id) || s.accLikes.some((t) => t.id === cur.id) : false))
  const liked = inMine || scLiked
  const [pop, setPop] = useState(0)
  const click = () => {
    if (!cur) return
    setPop(Date.now()) // сердечко подпрыгивает — видно, что нажал
    const sc = cur.src === 'sc'
    const was = useWave.getState().isLiked(cur)
    const t = cur
    void useWave.getState().toggleLike(cur)
      .then((m) => useUi.getState().toast(m, was
        ? { label: 'Вернуть', run: () => void useWave.getState().toggleLike(t).then((x) => useUi.getState().toast(x)).catch(() => {}) }
        : { label: 'Открыть', run: () => useUi.getState().go(sc ? 'soundcloud' : 'mine') }))
      .catch((e) => useUi.getState().toast((e as Error).message))
  }
  return (
    <button key={pop} className={'ic heart' + (cur?.src === 'sc' ? ' sc' : '') + (liked ? ' on' : '') + (pop ? ' pop' : '')} disabled={!cur}
      title={liked ? 'Убрать лайк' : cur?.src === 'sc' ? 'Нравится — в «Лайки» SoundCloud' : 'Нравится — в «Моё» (твоя музыка ВК)'} onClick={click}>
      <I.IHeart size={20} on={liked} />
    </button>
  )
}

export function DislikeBtn() {
  const cur = usePlayer((s) => s.current)
  // перечёркнутое сердце горит, когда открыт список «Не нравится»
  const on = useUi((s) => s.tab === 'disliked')
  return (
    <button className={'ic' + (on ? ' on' : '')} title={'Не нравится — больше не предлагать и включить следующий\nПравая кнопка — список «Не нравится»'}
      onClick={() => cur && void useWave.getState().dislike(cur).then(() => useUi.getState().toast('Больше не предложу. Список — правой кнопкой по сердцу'))}
      onContextMenu={(e) => { e.preventDefault(); useUi.getState().go('disliked') }}>
      <I.IHeartOff size={20} />
    </button>
  )
}

export function Controls({ compact = false, reactions = false }: { compact?: boolean; reactions?: boolean }) {
  const playing = usePlayer((s) => s.playing)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const p = player.getState()
  return (
    <div className="ctls">
      {reactions && <DislikeBtn />}
      <div className="mid">
      {!compact && <button className={'ic' + (shuffle ? ' on' : '')} title="Перемешать" onClick={() => player.getState().toggleShuffle()}><I.IShuffle size={18} /></button>}
      <button className="ic" aria-label="Назад" onClick={() => void p.prev()}><I.IPrev size={22} /></button>
      <button className="play" aria-label={playing ? 'Пауза' : 'Играть'} onClick={() => void player.getState().toggle()}>{playing ? <I.IPause size={24} /> : <I.IPlay size={24} />}</button>
      <button className="ic" aria-label="Вперёд" onClick={() => void p.next()}><I.INext size={22} /></button>
      {!compact && <button className={'ic' + (repeat !== 'off' ? ' on' : '')} title={repeat === 'one' ? 'Повтор трека' : repeat === 'all' ? 'Повтор списка' : 'Повтор выключен'} onClick={() => player.getState().cycleRepeat()}>{repeat === 'one' ? <I.IRepeatOne size={18} /> : <I.IRepeat size={18} />}</button>}
      </div>
      {reactions && <LikeBtn />}
    </div>
  )
}

/** Кнопка очереди: «Сейчас играет из …» и что дальше. Повторное нажатие — назад. */
function QueueBtn() {
  const on = useUi((s) => s.tab === 'queue')
  return <button className={'ic qbtn' + (on ? ' on' : '')} title="Очередь" onClick={() => (on ? useUi.getState().back() : useUi.getState().go('queue'))}><I.IList size={19} /></button>
}

/** Громкость колёсиком: наводишь на трек и крутишь — ±5% за щелчок, на секунду показываем процент. */
const useVolHint = create<{ at: number }>(() => ({ at: 0 }))
export function wheelVolume(e: React.WheelEvent) {
  if (!e.deltaY) return
  const v = player.getState().volume
  const next = Math.round(Math.min(1, Math.max(0, v + (e.deltaY < 0 ? 0.05 : -0.05))) * 100) / 100
  player.getState().setVolume(next)
  useVolHint.setState({ at: Date.now() })
}
function VolHint() {
  const at = useVolHint((s) => s.at)
  const volume = usePlayer((s) => s.volume)
  const [, tick] = useState(0)
  useEffect(() => { if (!at) return; const t = setTimeout(() => tick((x) => x + 1), 1100); return () => clearTimeout(t) }, [at])
  if (!at || Date.now() - at > 1000) return null
  return <div className="volhint">{volume > 0 ? <I.IVol size={16} /> : <I.IMute size={16} />}<b>{Math.round(volume * 100)}%</b><i style={{ width: `${Math.round(volume * 100)}%` }} /></div>
}

export function Stage() {
  const tab = useUi((s) => s.tab)
  const cur = usePlayer((s) => s.current)
  const source = usePlayer((s) => s.source)
  const duration = usePlayer((s) => s.duration)
  const volume = usePlayer((s) => s.volume)
  const pos = usePosition()
  const dur = duration || cur?.duration || 0
  // подпись «кроссфейд» загорается только в те секунды, когда переход и правда идёт
  const fading = playerHooks.crossfadeSec > 0 && dur > 0 && dur - pos <= playerHooks.crossfadeSec
  return (
    <section className="stage drag">
      <VolHint />
      <div className="top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="brand"><i />ХВОЯ</div>
          <button className={'hist nodrag' + (tab === 'history' ? ' on' : '')} onClick={() => useUi.getState().go('history')}><I.IClock size={15} />История</button>
          <button className={'hist sim nodrag' + (tab === 'similar' ? ' on' : '')} onClick={() => useUi.getState().go('similar')}><I.ISimilar size={15} />Похожее</button>
        </div>
        {source && <div className="src" title={'Играет из · ' + sourceLabel(source)}>из · <b>{sourceLabel(source)}</b></div>}
      </div>
      {!cur ? (
        <div className="empty">Ничего не играет.<br />Включи Волну или любой трек справа.</div>
      ) : (
        <>
          <div className="nodrag" style={{ display: 'contents' }} onContextMenu={(e) => openTrackMenu(e, [cur])} onWheel={wheelVolume}>
          <Cover className="cover nodrag" url={cur.coverUrl} seed={cur.id} />
          <div className="title nodrag" title={cur.title}>{cur.title}</div>
          <div className="artist nodrag"><SrcBadge src={cur.src === 'sc' ? 'sc' : 'vk'} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}><Artists names={cur.artist} src={cur.src} /></span></div>
          </div>
          <ScComments track={cur} pos={pos} />
          <Waveform id={cur.id} track={cur} progress={dur ? pos / dur : 0} onSeek={(f) => player.getState().seek(f * dur)} className="wf nodrag" />
          <div className="times"><span>{fmtTime(pos)}</span><b className={fading ? 'now' : ''}>{playerHooks.crossfadeSec ? `⤨ кроссфейд ${playerHooks.crossfadeSec} с` : 'без кроссфейда'}</b><span>{fmtTime(dur)}</span></div>
          <div className="ctl nodrag"><Controls reactions /></div>
          <div className="vol nodrag">
            <button className="ic" onClick={() => player.getState().setVolume(volume > 0 ? 0 : 0.8)} title="Звук">{volume > 0 ? <I.IVol size={18} /> : <I.IMute size={18} />}</button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onWheel={wheelVolume} title={`Громкость ${Math.round(volume * 100)}% · колёсико мыши тоже работает`} onChange={(e) => player.getState().setVolume(+e.target.value)} />
            <QueueBtn />
          </div>
        </>
      )}
    </section>
  )
}

export function MiniBar() {
  const cur = usePlayer((s) => s.current)
  const duration = usePlayer((s) => s.duration)
  const volume = usePlayer((s) => s.volume)
  const pos = usePosition()
  const dur = duration || cur?.duration || 0
  return (
    <div className="minibar">
      <VolHint />
      <div className="now nodrag" onContextMenu={(e) => cur && openTrackMenu(e, [cur])} onWheel={wheelVolume}>{cur && <><Cover className="cv" url={cur.coverUrl} seed={cur.id} /><div style={{ minWidth: 0 }}><div className="tt">{cur.title}</div><div className="ar"><SrcBadge src={cur.src === 'sc' ? 'sc' : 'vk'} /><Artists names={cur.artist} src={cur.src} /></div></div></>}</div>
      <Controls reactions />
      <div className="mright">
        {cur && <><span className="muted" style={{ font: '500 11px var(--M)' }}>{fmtTime(pos)}</span><Waveform id={cur.id} track={cur} n={36} progress={dur ? pos / dur : 0} onSeek={(f) => player.getState().seek(f * dur)} /></>}
        <QueueBtn />
        <button className="ic" onClick={() => player.getState().setVolume(volume > 0 ? 0 : 0.8)} title={volume > 0 ? 'Выключить звук' : 'Включить звук'}>{volume > 0 ? <I.IVol size={18} /> : <I.IMute size={18} />}</button>
        <input className="mvol" type="range" min={0} max={1} step={0.01} value={volume} onWheel={wheelVolume} title={`Громкость ${Math.round(volume * 100)}%`} onChange={(e) => player.getState().setVolume(+e.target.value)} />
      </div>
    </div>
  )
}
