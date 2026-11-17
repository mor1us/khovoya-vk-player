import { useEffect, useState } from 'react'
import type { ArtistSubscription } from '../../shared/types'
import { useUi } from '../store/ui'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'
import * as I from '../ui/icons'

type Source = 'vk' | 'sc'

export function Subscriptions() {
  const [revision, setRevision] = useState(0)
  return (
    <div className="page">
      <div className="ph">
        <h1>Мои подписки</h1><span className="sp" />
        <button className="btn-s" onClick={() => setRevision((n) => n + 1)}><I.IRefresh size={14} />Обновить</button>
      </div>
      <SubscriptionGroup source="vk" revision={revision} />
      <SubscriptionGroup source="sc" revision={revision} />
    </div>
  )
}

function SubscriptionGroup({ source, revision }: { source: Source; revision: number }) {
  const [artists, setArtists] = useState<ArtistSubscription[] | null>()
  const [failed, setFailed] = useState(false)
  const service = source === 'sc' ? 'SoundCloud' : 'ВК'
  useEffect(() => {
    let active = true
    let pending = false
    const load = async () => {
      if (pending) return
      pending = true
      try {
        const next = await window.api.invoke('artists:subscriptions', source)
        if (active) { setArtists(next); setFailed(false) }
      } catch { if (active) setFailed(true) }
      finally { pending = false }
    }
    const sync = () => { if (!document.hidden && document.hasFocus()) void load() }
    void load()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    const timer = window.setInterval(sync, 60_000)
    return () => {
      active = false
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
      window.clearInterval(timer)
    }
  }, [source, revision])
  return (
    <section className="box">
      <h3><SrcBadge src={source} />{service}</h3>
      {failed && <div className="empty-state">{artists?.length ? `Не удалось обновить подписки ${service}. Показан последний загруженный список.` : `Не удалось загрузить подписки ${service}. Попробуй обновить список.`}</div>}
      {artists === undefined ? !failed && <div className="skeleton" aria-label="Загружаю подписки" />
        : artists === null ? !failed && <div className="empty-state">Войди в {service}, чтобы увидеть подписки.</div>
        : !artists.length ? !failed && <div className="empty-state">Подписок на артистов пока нет.</div>
        : <div className="artgrid">{artists.map((artist) => (
          <button key={artist.id} className="art" title={`${artist.name} · ${service}`} onClick={() => useUi.getState().openArtist({ ...artist, src: source })}>
            <span className="avw"><Cover className="av" url={artist.cover} seed={source + artist.id} /></span>
            <span className="nm"><SrcBadge src={source} />{artist.name}</span>
          </button>
        ))}</div>}
    </section>
  )
}
