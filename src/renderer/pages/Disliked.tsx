import { useWave } from '../store/wave'
import { player } from '../store/playerInstance'
import { TrackRow } from '../ui/TrackRow'
import { plural } from '../ui/format'

/** «Не нравится»: всё, что ты отметил перечёркнутым сердцем. Отсюда трек можно вернуть. */
export function Disliked() {
  const list = useWave((s) => s.profile.disliked ?? [])
  return (
    <div className="page">
      <div className="ph">
        <h1>Не нравится</h1><span className="cnt">{list.length} {plural(list.length, 'трек', 'трека', 'треков')}</span><span className="sp" />
        {list.length > 0 && <span className="hint">Эти треки Волна больше не предлагает. «Вернуть» — если отметил случайно.</span>}
      </div>
      {!list.length && <div className="empty-state">Пока пусто. Перечёркнутое сердце в плеере убирает трек из Волны — он появится здесь.</div>}
      <div className="rows">
        {list.map((t, i) => (
          <div key={t.id} className="disrow">
            <TrackRow track={t} index={i} showSrc onPlay={() => void player.getState().playList([t], t.id, 'history')} />
            <button className="btn-s" onClick={() => useWave.getState().undislike(t)}>Вернуть</button>
          </div>
        ))}
      </div>
    </div>
  )
}
