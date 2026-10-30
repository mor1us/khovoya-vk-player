import { safeStorage, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import type { SessionStore, StoredSession } from './kate'

/** Ключ ВК, зашифрованный средствами Windows (DPAPI через safeStorage). Пароль сюда не попадает. */
export class TokenStore implements SessionStore {
  private file = join(app.getPath('userData'), 'session.bin')
  save(s: StoredSession) {
    const data = JSON.stringify(s)
    const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(data) : Buffer.from('plain:' + data)
    writeFileSync(this.file, buf)
  }
  load(): StoredSession | null {
    if (!existsSync(this.file)) return null
    try {
      const buf = readFileSync(this.file)
      const txt = buf.subarray(0, 6).toString() === 'plain:' ? buf.subarray(6).toString() : safeStorage.decryptString(buf)
      const s = JSON.parse(txt)
      return s.token ? s : null
    } catch { return null }
  }
  clear() { try { unlinkSync(this.file) } catch { /* нет файла */ } }
}
