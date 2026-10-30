import { useUi } from '../store/ui'
import { Home } from './Home'
import { Mine } from './Mine'
import { Search } from './Search'
import { Playlists } from './Playlists'
import { PlaylistPage } from './PlaylistPage'
import { Downloads } from './Downloads'
import { TrackMenu } from '../ui/TrackMenu'

export function Pages() {
  const tab = useUi((s) => s.tab)
  return (
    <>
      {tab === 'home' && <div className="page"><Home /></div>}
      {tab === 'mine' && <Mine />}
      {tab === 'search' && <Search />}
      {tab === 'playlists' && <Playlists />}
      {tab === 'playlist' && <PlaylistPage />}
      {tab === 'downloads' && <Downloads />}
      {!['home', 'mine', 'search', 'playlists', 'playlist', 'downloads'].includes(tab) && <div className="page"><div className="muted">Раздел скоро будет</div></div>}
      <TrackMenu />
    </>
  )
}
