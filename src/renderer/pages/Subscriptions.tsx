import { useEffect } from 'react'
import { useArtistSubscriptions, type ArtistService } from '../store/artistSubscriptions'
import { useSc } from '../store/sc'
import { useUi } from '../store/ui'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'
import { SubscriptionArtistSearch } from '../ui/SubscriptionArtistSearch'

export function Subscriptions() {
  const vkAccount = useUi((s) => s.session?.userId)
  const scAccount = useSc((s) => s.me?.id)
  return (
    <div className="page">
      <div className="ph"><h1>Мои подписки</h1></div>
      <SubscriptionGroup source="vk" account={vkAccount} />
      <SubscriptionGroup source="sc" account={scAccount} />
    </div>
  )
}

function SubscriptionGroup({ source, account }: { source: ArtistService; account?: number }) {
  const entry = useArtistSubscriptions((s) => s[source])
  const current = entry?.account === account ? entry : null
  const artists = current?.artists ?? []
  const service = source === 'vk' ? 'ВК' : 'SoundCloud'
  const loading = !!account && (!current || current.status === 'loading')
  const failed = current?.status === 'failed'
  const refresh = () => {
    if (account) void useArtistSubscriptions.getState().load(source, account, true).catch(() => {})
  }

  useEffect(() => {
    if (account) void useArtistSubscriptions.getState().load(source, account, true).catch(() => {})
  }, [source, account])

  return (
    <section className="box">
      <div className="ph">
        <h3><SrcBadge src={source} />{service}</h3><span className="sp" />
        {account && <button className={'btn-s' + (source === 'sc' ? ' sco' : '')} disabled={loading} onClick={refresh}>{loading ? 'Загружаю…' : 'Обновить'}</button>}
      </div>
      <SubscriptionArtistSearch source={source} service={service} />
      {failed && <p className="subscription-status" role="status">Не удалось обновить подписки {service}. Попробуй ещё раз.</p>}
      {!artists.length && !failed && <div className="empty-state">
        {loading ? 'Загружаю подписки…' : !account || current?.artists === null ? `Войди в ${service}, чтобы увидеть подписки.` : 'У тебя пока нет подписок. Найди исполнителя через поиск.'}
      </div>}
      {artists.length > 0 && <div className="artgrid">{artists.map((artist) => {
        const key = artist.id || artist.link || artist.name
        return (
          <button key={key} className="art" title={artist.name} onClick={() => useUi.getState().openArtist({ ...artist, id: artist.id || undefined, src: source })}>
            <span className="avw"><Cover className="av" url={artist.cover} seed={source + key} /></span>
            <span className="nm"><SrcBadge src={source} />{artist.name}</span>
          </button>
        )
      })}</div>}
    </section>
  )
}
