import { useUi } from '../store/ui'

export function Pages() {
  const tab = useUi((s) => s.tab)
  return <div className="page"><div className="muted">Раздел «{tab}» скоро будет</div></div>
}
