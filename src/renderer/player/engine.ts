import Hls from 'hls.js'
import { gains } from './crossfade'

type Deck = { audio: HTMLAudioElement; gain: GainNode; hls: Hls | null }

function curve(length: number, dir: 'in' | 'out'): Float32Array {
  const n = Math.max(2, Math.round(length * 60))
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const g = gains(i / (n - 1)); c[i] = dir === 'in' ? g.in : g.out }
  return c
}

/**
 * Две «деки»: одна играет, вторая готовит следующий трек для кроссфейда.
 * <audio> → MediaElementSource → свой GainNode → общая громкость → выход.
 */
export class PlayerEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private decks: Deck[] = []
  private active = 0
  private fading = false
  private timeCb: (t: number, d: number) => void = () => {}
  private endCb: () => void = () => {}
  private errCb: (e: unknown) => void = () => {}
  private volume = 0.8

  private ensure() {
    if (this.ctx) return
    this.ctx = new AudioContext({ latencyHint: 'playback' })
    this.master = this.ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(this.ctx.destination)
    for (let i = 0; i < 2; i++) {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      const gain = this.ctx.createGain()
      gain.gain.value = i === 0 ? 1 : 0
      this.ctx.createMediaElementSource(audio).connect(gain)
      gain.connect(this.master)
      const deck: Deck = { audio, gain, hls: null }
      audio.addEventListener('timeupdate', () => { if (this.decks[this.active] === deck) this.timeCb(audio.currentTime, audio.duration || 0) })
      audio.addEventListener('ended', () => { if (this.decks[this.active] === deck && !this.fading) this.endCb() })
      audio.addEventListener('error', () => { if (this.decks[this.active] === deck) this.errCb(audio.error) })
      this.decks.push(deck)
    }
  }

  private get cur() { this.ensure(); return this.decks[this.active] }
  private get other() { this.ensure(); return this.decks[1 - this.active] }

  private attach(deck: Deck, url: string): Promise<void> {
    deck.hls?.destroy(); deck.hls = null
    const a = deck.audio
    return new Promise((resolve, reject) => {
      const ok = () => { cleanup(); resolve() }
      const bad = () => { cleanup(); reject(new Error('Не удалось загрузить трек')) }
      const cleanup = () => { a.removeEventListener('canplay', ok); a.removeEventListener('error', bad) }
      a.addEventListener('canplay', ok)
      a.addEventListener('error', bad)
      if (/\.m3u8(\?|$)/.test(url) && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, maxBufferLength: 30, lowLatencyMode: false })
        deck.hls = hls
        hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) { hls.destroy(); deck.hls = null; bad() } })
        hls.loadSource(url)
        hls.attachMedia(a)
      } else {
        a.src = url
        a.load()
      }
    })
  }

  private unload(deck: Deck) {
    deck.audio.pause()
    deck.hls?.destroy(); deck.hls = null
    deck.audio.removeAttribute('src'); deck.audio.load()
  }

  /** Загрузить трек в играющую деку без перехода. */
  async load(url: string, startAt = 0) {
    this.cancelFade()
    this.ensure()
    const d = this.cur
    await this.attach(d, url)
    if (startAt > 0) d.audio.currentTime = startAt
    d.gain.gain.cancelScheduledValues(0); d.gain.gain.value = 1
    this.other.gain.gain.value = 0
  }

  async play() { this.ensure(); await this.ctx!.resume(); await this.cur.audio.play() }
  pause() { if (this.ctx) this.cur.audio.pause() }
  get paused() { return !this.ctx || this.cur.audio.paused }
  get time() { return this.ctx ? this.cur.audio.currentTime : 0 }
  get duration() { return this.ctx ? this.cur.audio.duration || 0 : 0 }
  seek(s: number) { if (this.ctx) this.cur.audio.currentTime = Math.max(0, s) }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03)
  }

  private cancelFade() {
    if (!this.ctx || !this.fading) return
    for (const d of this.decks) d.gain.gain.cancelScheduledValues(0)
    this.fading = false
  }

  /** Плавный переход к новому треку за lengthSec секунд. Бросает ошибку, если новый трек не загрузился. */
  async crossfadeTo(url: string, lengthSec: number) {
    this.ensure()
    this.cancelFade()
    const from = this.cur, to = this.other
    await this.attach(to, url)
    const now = this.ctx!.currentTime
    to.gain.gain.cancelScheduledValues(now); from.gain.gain.cancelScheduledValues(now)
    to.gain.gain.setValueAtTime(0, now)
    await this.ctx!.resume()
    await to.audio.play()
    this.fading = true
    this.active = 1 - this.active
    to.gain.gain.setValueCurveAtTime(curve(lengthSec, 'in'), now, lengthSec)
    from.gain.gain.setValueCurveAtTime(curve(lengthSec, 'out'), now, lengthSec)
    setTimeout(() => { if (this.decks[1 - this.active] === from) this.unload(from); this.fading = false }, lengthSec * 1000 + 80)
  }

  onTimeUpdate(cb: (t: number, d: number) => void) { this.timeCb = cb }
  onEnded(cb: () => void) { this.endCb = cb }
  onError(cb: (e: unknown) => void) { this.errCb = cb }
}
