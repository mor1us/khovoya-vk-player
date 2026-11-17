import { useState } from 'react'
import { useUi } from '../store/ui'
import { useLocalArtists } from '../store/localArtists'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'

type Source = 'vk' | 'sc'

export function Subscriptions() {
  return (
    <div className="page">
      <div className="ph"><h1>Мои подписки</h1></div>
      <SubscriptionGroup source="vk" />
      <SubscriptionGroup source="sc" />
    </div>
  )
}

function SubscriptionGroup({ source }: { source: Source }) {
  const local = useLocalArtists((s) => s.artists.filter((artist) => artist.source === source))
  const [busy, setBusy] = useState(false)
  const service = source === 'sc' ? 'SoundCloud' : 'ВК'
  const importArtists = async () => {
    if (busy) return
    setBusy(true)
    try {
      const imported = await window.api.invoke('artists:subscriptions', source)
      if (imported === null) useUi.getState().toast(`Войди в ${service}, чтобы импортировать артистов`)
      else {
        const count = useLocalArtists.getState().import(source, imported)
        useUi.getState().toast(count ? `В Хвою добавлено: ${count}` : `Новых артистов в ${service} нет`)
      }
    } catch { useUi.getState().toast(`Не удалось импортировать артистов из ${service}`) }
    finally { setBusy(false) }
  }
  return (
    <section className="box">
      <div className="ph"><h3><SrcBadge src={source} />{service}</h3><span className="sp" /><button className={'btn-s' + (source === 'sc' ? ' sco' : '')} disabled={busy} onClick={() => void importArtists()}>{busy ? 'Импортирую…' : `Импортировать из ${service}`}</button></div>
      {!local.length ? <div className="empty-state">Добавь артистов в Хвою на странице исполнителя или импортируй их из {service}.</div>
        : <div className="artgrid">{local.map((artist) => (
          <button key={`${source}:${artist.id}`} className="art" title={`${artist.name} · подписка Хвои · ${service}`} onClick={() => useUi.getState().openArtist({ ...artist, src: source })}>
            <span className="avw"><Cover className="av" url={artist.cover} seed={source + artist.id} /></span>
            <span className="nm"><SrcBadge src={source} />{artist.name}</span>
          </button>
        ))}</div>}
    </section>
  )
}
