import { useEffect, useState } from 'react'
import { vkSubscriptionMessages } from '../../shared/vkSubscriptionStatus'
import { useArtistSubscriptions, type ArtistService } from '../store/artistSubscriptions'
import { useSc } from '../store/sc'
import { useUi } from '../store/ui'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'
import { SubscriptionArtistSearch } from '../ui/SubscriptionArtistSearch'
import { IBack, IForward } from '../ui/icons'

const ARTISTS_PER_PAGE = 9

export function Subscriptions() {
  const vkAccount = useUi((s) => s.session?.userId)
  const scAccount = useSc((s) => s.me?.id)
  return (
    <div className="page">
      <div className="ph"><h1>Мои подписки</h1></div>
      <SubscriptionGroup key={'vk:' + vkAccount} source="vk" account={vkAccount} />
      <SubscriptionGroup key={'sc:' + scAccount} source="sc" account={scAccount} />
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
  const [openingVk, setOpeningVk] = useState(false)
  const [requestedPage, setPage] = useState(0)
  const pageCount = Math.ceil(artists.length / ARTISTS_PER_PAGE)
  const page = Math.min(requestedPage, Math.max(0, pageCount - 1))
  const first = page * ARTISTS_PER_PAGE
  const paged = pageCount > 1
  const refresh = () => {
    if (account) void useArtistSubscriptions.getState().load(source, account, true).catch(() => {})
  }
  const openVk = async () => {
    setOpeningVk(true)
    try {
      await window.api.invoke('vk:openSubscriptions')
      if (account === useUi.getState().session?.userId) refresh()
    } catch {
      useUi.getState().toast('Не удалось открыть ВК. Попробуй ещё раз.')
    } finally { setOpeningVk(false) }
  }

  useEffect(() => {
    if (account) void useArtistSubscriptions.getState().load(source, account, source === 'sc').catch(() => {})
  }, [source, account])

  return (
    <section className="box">
      <div className="ph">
        <h3><SrcBadge src={source} />{service}</h3><span className="sp" />
        {account && <button className={'btn-s' + (source === 'sc' ? ' sco' : '')} disabled={loading || openingVk} onClick={refresh}>{loading ? 'Загружаю…' : 'Обновить'}</button>}
      </div>
      <SubscriptionArtistSearch source={source} service={service} />
      {failed && <p className="subscription-status" role="status">
        {current.reason ? `${vkSubscriptionMessages[current.reason]} После этого закрой окно ВК, и Хвоя обновит список.` : `Не удалось обновить подписки ${service}. Попробуй ещё раз.`}
      </p>}
      {failed && source === 'vk' && account && <button className="btn-s" disabled={openingVk} onClick={() => void openVk()}>
        {openingVk ? 'Окно ВК открыто' : 'Открыть ВК'}
      </button>}
      {!artists.length && !failed && <div className="empty-state">
        {loading ? 'Загружаю подписки…' : !account || current?.artists === null ? `Войди в ${service}, чтобы увидеть подписки.` : 'У тебя пока нет подписок. Найди исполнителя через поиск.'}
      </div>}
      {artists.length > 0 && <div className={'subscription-carousel' + (paged ? ' paged' : '')} role="group" aria-label={'Подписки ' + service}>
        {paged && <button type="button" className="ic" title="Предыдущая страница" aria-label={'Предыдущая страница ' + service}
          disabled={page === 0} onClick={() => setPage(page - 1)}><IBack size={28} /></button>}
        <div className="artgrid">{artists.slice(first, first + ARTISTS_PER_PAGE).map((artist) => {
          const key = artist.id || artist.link || artist.name
          return (
            <button key={key} className="art" title={artist.name} onClick={() => useUi.getState().openArtist({ ...artist, id: artist.id || undefined, src: source })}>
              <span className="avw"><Cover className="av" url={artist.cover} seed={source + key} /></span>
              <span className="nm"><SrcBadge src={source} />{artist.name}</span>
            </button>
          )
        })}</div>
        {paged && <button type="button" className="ic" title="Следующая страница" aria-label={'Следующая страница ' + service}
          disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}><IForward size={28} /></button>}
      </div>}
    </section>
  )
}
