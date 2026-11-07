import { useUi } from '../store/ui'
import { Home } from './Home'
import { Mine } from './Mine'
import { PhoneMine } from './PhoneMine'
import { Search } from './Search'
import { Playlists } from './Playlists'
import { PlaylistPage } from './PlaylistPage'
import { Artist } from './Artist'
import { Downloads } from './Downloads'
import { Settings } from './Settings'
import { History } from './History'
import { Similar } from './Similar'
import { Queue } from './Queue'
import { Disliked } from './Disliked'
import { SoundCloud } from './SoundCloud'
import { TrackMenu } from '../ui/TrackMenu'
import { isPhone } from '../ui/layout'

export function Pages({ onLogout }: { onLogout: () => void }) {
  const tab = useUi((s) => s.tab)
  return (
    <>
      {tab === 'home' && <div className="page"><Home /></div>}
      {tab === 'mine' && (isPhone() ? <PhoneMine /> : <Mine />)}
      {tab === 'search' && <Search />}
      {tab === 'playlists' && <Playlists />}
      {tab === 'playlist' && <PlaylistPage />}
      {tab === 'artist' && <Artist />}
      {tab === 'downloads' && <Downloads />}
      {tab === 'settings' && <Settings onLogout={onLogout} />}
      {tab === 'history' && <History />}
      {tab === 'similar' && <Similar />}
      {tab === 'queue' && <Queue />}
      {tab === 'disliked' && <Disliked />}
      {tab === 'soundcloud' && <SoundCloud />}
      <TrackMenu />
    </>
  )
}
