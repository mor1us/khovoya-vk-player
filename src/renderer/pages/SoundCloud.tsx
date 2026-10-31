import { useEffect, useState } from 'react'
import { useSc } from '../store/sc'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { Crates } from '../ui/Crates'
import { WaveCard } from '../ui/WaveCard'
import { createPlaylistWith } from '../store/playlists'
import { ask } from '../ui/Dialog'
import { plural } from '../ui/format'
import * as I from '../ui/icons'
import { SrcBadge } from '../ui/TrackRow'

type Part = 'likes' | 'playlists'

/** Вкладка SoundCloud: Волны, лайки («Моё · SoundCloud») и плейлисты Хвои. */
export function SoundCloud() {
  const likes = useSc((s) => s.likes)
  const all = useLibrary((s) => s.playlists)
  const local = all.filter((p) => p.local)
  const [part, setPart] = useState<Part>('likes')
  const [q, setQ] = useState('')
  const [st, setSt] = useState<{ ok: boolean; message?: string; hasKey: boolean } | null>(null)
  const check = () => { setSt(null); window.api.invoke<{ ok: boolean; message?: string; hasKey: boolean }>('sc:prepare').then(setSt).catch(() => {}) }
  useEffect(() => {
    void useSc.getState().load()
    check() // берём/обновляем ключ, если сайт открывается, и проверяем связь
  }, [])
  const down = st && !st.ok ? st.message ?? 'SoundCloud недоступен' : ''
  const list = q ? likes.filter((t) => `${t.artist} ${t.title}`.toLowerCase().includes(q.toLowerCase())) : likes
  const play = (shuffle: boolean) => {
    if (!list.length) return
    if (shuffle !== player.getState().shuffle) player.getState().toggleShuffle()
    void player.getState().playList(list, (shuffle ? list[Math.floor(Math.random() * list.length)] : list[0]).id, 'pl:Моё · SoundCloud')
  }
  async function newLocal() {
    const name = await ask('Новый плейлист Хвои (ВК + SoundCloud)', '', 'Создать')
    if (name?.trim()) { const p = await createPlaylistWith(name.trim(), [], true); if (p) useUi.getState().openPlaylist(p) }
  }
  return (
    <div className="page fill scpage">
      <div className="ph">
        <h1 className="sch">SoundCloud</h1>
        <div className="seg sc">
          <button className={part === 'likes' ? 'on' : ''} onClick={() => setPart('likes')}>Лайки · {likes.length}</button>
          <button className={part === 'playlists' ? 'on' : ''} onClick={() => setPart('playlists')}>Плейлисты Хвои · {local.length}</button>
        </div>
        <span className="sp" />
        <span className="hint">Ищи сразу везде — в поиске сверху треки SoundCloud помечены <b className="srcb sc">SC</b></span>
      </div>
      {down && <div className="scdown big"><SrcBadge src="sc" /><span><b>{down}</b><br />ВК, «Моё · SoundCloud» и плейлисты Хвои работают и так. Треки SoundCloud, которые не грузятся, Хвоя попробует найти и сыграть из ВК.</span><button className="btn-s" onClick={check}>Проверить снова</button></div>}
      {st?.ok && <div className="scok"><i />SoundCloud работает{st.hasKey ? ' · ключ сохранён на компе — можно без VPN, пока SoundCloud его не сменит' : ''}</div>}
      {!st && <div className="scok wait"><i />Проверяю связь с SoundCloud…</div>}
      <div className="scwaves"><WaveCard only={['sc', 'both']} /></div>
      {part === 'likes' && <>
        <div className="ph" style={{ marginTop: 18 }}>
          <h2 className="sub">Моё · SoundCloud</h2><span className="cnt">{likes.length} {plural(likes.length, 'трек', 'трека', 'треков')}</span><span className="sp" />
          <input className="filter" placeholder="Поиск в лайках" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-s" onClick={() => play(false)}><I.IPlay size={14} />Играть</button>
          <button className="btn-s sco" onClick={() => play(true)}><I.IShuffle size={14} />Перемешать</button>
        </div>
        {list.length
          ? <VirtualTrackList tracks={list} onPlay={(t) => void player.getState().playList(list, t.id, 'pl:Моё · SoundCloud')} />
          : <div className="empty-state">{q ? 'Ничего не нашлось' : 'Лайкай треки SoundCloud сердечком в плеере — они соберутся здесь.'}</div>}
      </>}
      {part === 'playlists' && <>
        <div className="ph" style={{ marginTop: 18 }}>
          <h2 className="sub">Плейлисты Хвои</h2><span className="hint">Хранятся на компе, в них можно смешивать ВК и SoundCloud</span><span className="sp" />
          <button className="btn-s sco" onClick={() => void newLocal()}><I.IPlus size={14} />Новый</button>
        </div>
        {local.length ? <Crates list={local} /> : <div className="empty-state">Пока нет. Создай кнопкой «Новый» или через «…» у трека → «Добавить в плейлист» → «+ Новый плейлист Хвои».</div>}
      </>}
    </div>
  )
}
