import { Client } from '@xhayper/discord-rpc'
import type { Activity } from './discordActivity'

/** Статус «Слушает» в Discord. Discord не запущен — тихо пробуем раз в 30 с. */
export class DiscordPresence {
  private client: Client | null = null
  private appId = ''
  private ready = false
  private last: Activity | null = null
  private retry: NodeJS.Timeout | null = null
  constructor(private log: (m: string) => void = () => {}) {}

  start(appId: string) {
    if (!appId) { this.stop(); return }
    if (appId === this.appId && this.client) return
    this.stop()
    this.appId = appId
    this.connect()
  }

  private connect() {
    if (!this.appId) return
    const c = new Client({ clientId: this.appId, transport: { type: 'ipc' } })
    this.client = c
    c.on('ready', () => { this.ready = true; this.log('discord: подключено'); void this.push() })
    c.on('disconnected', () => { this.ready = false; this.schedule() })
    c.login().catch((e) => { this.ready = false; this.log('discord: не подключился — ' + String((e as Error)?.message ?? e)); this.schedule() })
  }

  private schedule() {
    if (this.retry || !this.appId) return
    this.retry = setTimeout(() => { this.retry = null; try { void this.client?.destroy() } catch { /* */ } this.client = null; this.connect() }, 30_000)
  }

  update(a: Activity | null) { this.last = a; void this.push() }

  private async push() {
    if (!this.ready || !this.client?.user) return
    try {
      if (this.last) await this.client.user.setActivity(this.last as any)
      else await this.client.user.clearActivity()
    } catch (e) { this.log('discord: статус не принят — ' + String((e as Error)?.message ?? e)) }
  }

  stop() {
    if (this.retry) { clearTimeout(this.retry); this.retry = null }
    const c = this.client
    this.client = null; this.ready = false; this.appId = ''
    if (c) { c.user?.clearActivity().catch(() => {}); void c.destroy().catch(() => {}) }
  }
}
