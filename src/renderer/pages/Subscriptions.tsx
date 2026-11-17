import { useEffect, useState } from 'react'
import type { ArtistSubscription } from '../../shared/types'
import { useUi } from '../store/ui'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'
import * as I from '../ui/icons'

type Source = 'vk' | 'sc'
type Result = { artists: ArtistSubscription[] | null } | { error: true }

export function Subscriptions() {
  const [revision, setRevision] = useState(0)
  return (
    <div className="page">
      <div className="ph">
        <h1>Мои подписки</h1><span className="sp" />
        <button className="btn-s" onClick={() => setRevision((n) => n + 1)}><I.IRefresh size={14} />Обновить</button>
      </div>
      <SubscriptionGroup key={'vk:' + revision} source="vk" />
      <SubscriptionGroup key={'sc:' + revision} source="sc" />
    </div>
  )
}

function SubscriptionGroup({ source }: { source: Source }) {
  const [result, setResult] = useState<Result>()
  const service = source === 'sc' ? 'SoundCloud' : 'ВК'
  useEffect(() => {
    let active = true
    window.api.invoke('artists:subscriptions', source)
      .then((artists) => { if (active) setResult({ artists }) })
      .catch(() => { if (active) setResult({ error: true }) })
    return () => { active = false }
  }, [source])
  return (
    <section className="box">
      <h3><SrcBadge src={source} />{service}</h3>
      {!result ? <div className="skeleton" aria-label="Загружаю подписки" />
        : 'error' in result ? <div className="empty-state">Не удалось загрузить подписки {service}. Попробуй обновить список.</div>
        : !result.artists ? <div className="empty-state">Войди в {service}, чтобы увидеть подписки.</div>
        : !result.artists.length ? <div className="empty-state">Подписок на артистов пока нет.</div>
        : <div className="artgrid">{result.artists.map((artist) => (
          <button key={artist.id} className="art" title={`${artist.name} · ${service}`} onClick={() => useUi.getState().openArtist({ ...artist, src: source })}>
            <span className="avw"><Cover className="av" url={artist.cover} seed={source + artist.id} /></span>
            <span className="nm"><SrcBadge src={source} />{artist.name}</span>
          </button>
        ))}</div>}
    </section>
  )
}
