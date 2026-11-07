import { useEffect, useRef, useState } from 'react'
import type { ScStatus, Track } from '../../shared/types'
import { useSc } from '../store/sc'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { player } from '../store/playerInstance'
import { VirtualTrackList } from '../ui/VirtualTrackList'
import { Crates } from '../ui/Crates'
import { WaveCard } from '../ui/WaveCard'
import { Cover } from '../ui/Cover'
import { createPlaylistWith } from '../store/playlists'
import { ask, confirmAsk } from '../ui/Dialog'
import { plural } from '../ui/format'
import * as I from '../ui/icons'
import { SrcBadge } from '../ui/TrackRow'
import { useHScroll, Arrows } from '../ui/HScroll'

type Part = 'likes' | 'playlists' | 'feed'
type Status = ScStatus

/** Вход в аккаунт SoundCloud: кнопка или аватар с именем. */
function Account() {
  const me = useSc((s) => s.me)
  const [busy, setBusy] = useState(false)
  const login = async () => {
    setBusy(true)
    try { await useSc.getState().login(); useUi.getState().toast('Готово: лайки и плейлисты SoundCloud подтянуты') }
    catch (e) { const m = (e as Error).message; if (m !== 'Окно входа закрыто') useUi.getState().toast(m) }
    finally { setBusy(false) }
  }
  if (!me) return <button className="btn-s sco" disabled={busy} onClick={() => void login()} title="Откроется сайт SoundCloud. Пароль вводится только там">{busy ? 'Жду вход…' : 'Войти в SoundCloud'}</button>
  return (
    <div className="scacc">
      <Cover className="av" url={me.avatar} seed={'scme' + me.id} />
      <b>{me.name}</b>
      <button className="link" onClick={async () => { if (await confirmAsk('Выйти из SoundCloud в Хвое?', 'Выйти')) await useSc.getState().logout() }}>Выйти</button>
    </div>
  )
}

/** Вкладка SoundCloud: аккаунт, Волны, лайки, плейлисты (SoundCloud и Хвои), лента подписок. */
export function SoundCloud() {
  const local = useSc((s) => s.likes)
  const acc = useSc((s) => s.accLikes)
  const me = useSc((s) => s.me)
  const accPl = useSc((s) => s.accPlaylists)
  const feed = useSc((s) => s.feed)
  const accError = useSc((s) => s.accError)
  const all = useLibrary((s) => s.playlists)
  const khPl = all.filter((p) => p.local)
  const [part, setPart] = useState<Part>('likes')
  const [q, setQ] = useState('')
  const [st, setSt] = useState<Status | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const accRow = useHScroll()
  const khRow = useHScroll()
  const check = () => { setSt(null); window.api.invoke('sc:prepare').then(setSt).catch(() => {}) }
  useEffect(() => {
    void useSc.getState().load()
    check() // берём/обновляем ключ, если сайт открывается, и проверяем связь
  }, [])
  useEffect(() => { if (part === 'feed' && me && feed === null) void useSc.getState().loadFeed() }, [part, me, feed])
  const likes = useSc.getState().allLikes()
  void local; void acc // подписка на изменения
  const list = q ? likes.filter((t) => `${t.artist} ${t.title}`.toLowerCase().includes(q.toLowerCase())) : likes
  const down = st && !st.ok ? st.message ?? 'SoundCloud недоступен' : ''
  const play = (ts: Track[], shuffle: boolean, src: string) => {
    if (!ts.length) return
    if (shuffle !== player.getState().shuffle) player.getState().toggleShuffle()
    void player.getState().playList(ts, (shuffle ? ts[Math.floor(Math.random() * ts.length)] : ts[0]).id, src)
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
          <button className={part === 'playlists' ? 'on' : ''} onClick={() => setPart('playlists')}>Плейлисты · {accPl.length + khPl.length}</button>
          <button className={part === 'feed' ? 'on' : ''} onClick={() => setPart('feed')}>Лента</button>
        </div>
        <span className="sp" />
        <Account />
      </div>
      <div className="pagescroll" ref={scroll}>
      {down && <div className="scdown big"><SrcBadge src="sc" /><span><b>{down}</b><br />ВК, лайки SoundCloud и плейлисты Хвои работают и так. Треки SoundCloud, которые не грузятся, Хвоя попробует найти и сыграть из ВК.</span><button className="btn-s" onClick={check}>Проверить снова</button></div>}
      {st?.ok && <div className="scok"><i />SoundCloud работает{st.hasKey ? ' · ключ сохранён на компе — можно без VPN, пока SoundCloud его не сменит' : ''}</div>}
      {!st && <div className="scok wait"><i />Проверяю связь с SoundCloud…</div>}
      {accError && me && <div className="scdown"><SrcBadge src="sc" />{accError}</div>}
      <div className="scwaves"><WaveCard only={['sc', 'both']} /></div>

      {part === 'likes' && <>
        <div className="ph" style={{ marginTop: 18 }}>
          <h2 className="sub">Лайки</h2><span className="cnt">{likes.length} {plural(likes.length, 'трек', 'трека', 'треков')}{me ? ` · из аккаунта ${acc.length}` : ''}</span><span className="sp" />
          <input className="filter" placeholder="Поиск в лайках" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-s" onClick={() => play(list, false, 'sc:likes')}><I.IPlay size={14} />Играть</button>
          <button className="btn-s sco" onClick={() => play(list, true, 'sc:likes')}><I.IShuffle size={14} />Перемешать</button>
        </div>
        {list.length
          ? <VirtualTrackList tracks={list} scroller={scroll} onPlay={(t) => void player.getState().playList(list, t.id, 'sc:likes')} />
          : <div className="empty-state">{q ? 'Ничего не нашлось' : me ? 'В аккаунте пока нет лайков. Лайкай треки сердечком в плеере.' : 'Лайкай треки SoundCloud сердечком в плеере — или войди в аккаунт, чтобы подтянуть свои лайки.'}</div>}
      </>}

      {part === 'playlists' && <>
        {me && <>
          <div className="ph" style={{ marginTop: 18 }}><h2 className="sub">Из аккаунта SoundCloud</h2><span className="cnt">{accPl.length}</span><span className="sp" /><Arrows s={accRow} /></div>
          {accPl.length ? <Crates list={accPl} rowRef={accRow.ref} /> : <div className="empty-state">В аккаунте нет плейлистов</div>}
        </>}
        <div className="ph" style={{ marginTop: 18 }}>
          <h2 className="sub">Плейлисты Хвои</h2><span className="hint">Хранятся на компе, в них можно смешивать ВК и SoundCloud</span><span className="sp" />
          <button className="btn-s sco" onClick={() => void newLocal()}><I.IPlus size={14} />Новый</button><Arrows s={khRow} />
        </div>
        {khPl.length ? <Crates list={khPl} rowRef={khRow.ref} /> : <div className="empty-state">Пока нет. Создай кнопкой «Новый» или через «…» у трека → «Добавить в плейлист» → «+ Новый плейлист Хвои».</div>}
      </>}

      {part === 'feed' && <>
        <div className="ph" style={{ marginTop: 18 }}>
          <h2 className="sub">Новое от подписок</h2><span className="sp" />
          {me && <button className="btn-s" onClick={() => void useSc.getState().loadFeed()}>↻ Обновить</button>}
          {me && !!feed?.length && <button className="btn-s sco" onClick={() => play(feed, false, 'sc:feed')}><I.IPlay size={14} />Слушать</button>}
        </div>
        {!me ? <div className="empty-state">Войди в SoundCloud (кнопка справа сверху) — здесь появятся новые треки тех, на кого ты подписан.</div>
          : feed === null ? <div className="rows">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}</div>
          : feed.length ? <VirtualTrackList tracks={feed} scroller={scroll} onPlay={(t) => void player.getState().playList(feed, t.id, 'sc:feed')} />
          : <div className="empty-state">В ленте пусто — подпишись на артистов на SoundCloud.</div>}
      </>}
      </div>
    </div>
  )
}
