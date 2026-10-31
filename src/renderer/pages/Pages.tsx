import { useUi } from '../store/ui'
import { Home } from './Home'
import { Mine } from './Mine'
import { Search } from './Search'
import { Playlists } from './Playlists'
import { PlaylistPage } from './PlaylistPage'
import { Downloads } from './Downloads'
import { Settings } from './Settings'
import { History } from './History'
import { Similar } from './Similar'
import { TrackMenu } from '../ui/TrackMenu'

export function Pages({ onLogout }: { onLogout: () => void }) {
  const tab = useUi((s) => s.tab)
  return (
    <>
      {tab === 'home' && <div className="page"><Home /></div>}
      {tab === 'mine' && <Mine />}
      {tab === 'search' && <Search />}
      {tab === 'playlists' && <Playlists />}
      {tab === 'playlist' && <PlaylistPage />}
      {tab === 'downloads' && <Downloads />}
      {tab === 'settings' && <Settings onLogout={onLogout} />}
      {tab === 'history' && <History />}
      {tab === 'similar' && <Similar />}
      <TrackMenu />
    </>
  )
}
