import { useEffect, useState } from 'react'
import { create } from 'zustand'

type D = { kind: 'prompt' | 'confirm'; title: string; value: string; danger?: boolean; ok: string; resolve: (v: string | boolean | null) => void } | null
const useD = create<{ d: D }>(() => ({ d: null }))

export function ask(title: string, initial = '', ok = 'Готово'): Promise<string | null> {
  return new Promise((resolve) => useD.setState({ d: { kind: 'prompt', title, value: initial, ok, resolve: (v) => resolve(v as string | null) } }))
}
export function confirmAsk(title: string, ok = 'Да', danger = false): Promise<boolean> {
  return new Promise((resolve) => useD.setState({ d: { kind: 'confirm', title, value: '', ok, danger, resolve: (v) => resolve(v === true) } }))
}

export function DialogHost() {
  const d = useD((s) => s.d)
  const [v, setV] = useState('')
  useEffect(() => { setV(d?.value ?? '') }, [d])
  if (!d) return null
  const close = (r: string | boolean | null) => { useD.setState({ d: null }); d.resolve(r) }
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) close(d.kind === 'confirm' ? false : null) }}>
      <form className="box" onSubmit={(e) => { e.preventDefault(); close(d.kind === 'prompt' ? v : true) }} onKeyDown={(e) => { if (e.key === 'Escape') close(d.kind === 'confirm' ? false : null) }}>
        <h3>{d.title}</h3>
        {d.kind === 'prompt' && <input className="field" autoFocus value={v} onChange={(e) => setV(e.target.value)} />}
        <div className="ta">
          <button type="button" className="btn-s" onClick={() => close(d.kind === 'confirm' ? false : null)}>Отмена</button>
          <button className={'btn-s ' + (d.danger ? 'bad' : 'g')} autoFocus={d.kind === 'confirm'}>{d.ok}</button>
        </div>
      </form>
    </div>
  )
}
