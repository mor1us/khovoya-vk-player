import type { Track } from '../../shared/types'
import { smartShuffle } from './shuffle'

export type Repeat = 'off' | 'all' | 'one'
export type QueueJSON = { original: Track[]; order: Track[]; index: number; source: string; repeat: Repeat; shuffled: boolean }

export class Queue {
  private original: Track[]
  private order: Track[]
  private index: number
  repeat: Repeat = 'off'
  shuffled = false

  constructor(tracks: Track[], startIndex: number, public source: string) {
    this.original = tracks.slice()
    this.order = tracks.slice()
    this.index = Math.max(0, Math.min(startIndex, tracks.length - 1))
    if (this.order.length && !this.order[this.index]?.available) {
      const i = this.findFrom(this.index, 1, true)
      this.index = i ?? this.index
    }
  }

  list(): Track[] { return this.order }
  current(): Track | null { const t = this.order[this.index]; return t && t.available ? t : null }
  currentIndex(): number { return this.index }
  remaining(): number { return this.order.length - 1 - this.index }

  private findFrom(start: number, dir: 1 | -1, wrap: boolean): number | null {
    const n = this.order.length
    for (let step = 0; step < n; step++) {
      let i = start + dir * step
      if (i >= n || i < 0) { if (!wrap) return null; i = ((i % n) + n) % n }
      if (this.order[i]?.available) return i
    }
    return null
  }

  peekNext(): Track | null {
    if (this.repeat === 'one') return this.current()
    const i = this.findFrom(this.index + 1, 1, this.repeat === 'all')
    return i === null ? null : this.order[i]
  }

  /** auto=true — трек доиграл сам; false — пользователь нажал «вперёд». */
  next(auto: boolean): Track | null {
    if (auto && this.repeat === 'one') return this.current()
    const i = this.findFrom(this.index + 1, 1, this.repeat === 'all' || (this.repeat === 'one' && !auto))
    if (i === null) return null
    this.index = i
    return this.order[i]
  }

  prev(): Track | null {
    const i = this.findFrom(this.index - 1, -1, this.repeat !== 'off')
    if (i === null) return this.current()
    this.index = i
    return this.order[i]
  }

  jumpTo(id: string) { const i = this.order.findIndex((t) => t.id === id); if (i >= 0) this.index = i }

  append(tracks: Track[]) { this.order.push(...tracks); this.original.push(...tracks) }

  setShuffle(on: boolean, recent: string[]) {
    const cur = this.order[this.index]
    this.shuffled = on
    this.order = on ? smartShuffle(this.original, { firstId: cur?.id, recent }) : this.original.slice()
    this.index = Math.max(0, cur ? this.order.findIndex((t) => t.id === cur.id) : 0)
  }

  toJSON(): QueueJSON {
    return { original: this.original, order: this.order, index: this.index, source: this.source, repeat: this.repeat, shuffled: this.shuffled }
  }

  static fromJSON(j: QueueJSON): Queue {
    const q = new Queue(j.original, 0, j.source)
    q.order = j.order.slice(); q.index = Math.min(j.index, Math.max(0, j.order.length - 1))
    q.repeat = j.repeat; q.shuffled = j.shuffled
    return q
  }
}
