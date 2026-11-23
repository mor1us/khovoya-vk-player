/** Подпись официального приложения ВК: методы audio.* отдаются только ему. */
export const VK_UA = 'VKAndroidApp/8.175-51775 (Android 14; SDK 34; arm64-v8a; ru)'
export const API_VERSION = '5.131'

export class VkError extends Error {
  constructor(public code: number, message: string) { super(message) }
}

type Opts = {
  token: () => Promise<string | null>
  /** ВК отверг ключ (ошибка 5) — получить свежий перед повтором. */
  onTokenRejected?: () => void
  fetch?: typeof fetch
  onAuthLost: () => void
  onCaptcha: (sid: string, img: string) => Promise<string>
  sleep?: (ms: number) => Promise<void>
}

export class VkClient {
  private f: typeof fetch
  private sleep: (ms: number) => Promise<void>
  constructor(private o: Opts) {
    this.f = o.fetch ?? fetch
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  async call<T = unknown>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
    let token = await this.o.token()
    if (!token) throw new VkError(5, 'Нужно войти в ВК')
    const extra: Record<string, string> = {}
    let renewed = false
    for (let attempt = 1; ; attempt++) {
      const body = new URLSearchParams({ access_token: token, v: API_VERSION, lang: 'ru' })
      for (const [k, v] of Object.entries({ ...params, ...extra })) if (v !== undefined) body.set(k, String(v))
      const res = await this.f(`https://api.vk.com/method/${method}`, {
        method: 'POST',
        headers: { 'User-Agent': VK_UA, 'X-VK-Android-Client': 'new', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
      const json = (await res.json()) as { response?: T; error?: { error_code: number; error_msg?: string; captcha_sid?: string; captcha_img?: string } }
      if (!json.error) return json.response as T
      const { error_code: code, error_msg } = json.error
      if (code === 6 && attempt < 3) { await this.sleep(400 * attempt); continue }
      if (code === 5 && !renewed && this.o.onTokenRejected) {
        renewed = true; this.o.onTokenRejected()
        const t = await this.o.token(); if (t) { token = t; continue }
      }
      if (code === 5) { this.o.onAuthLost(); throw new VkError(5, 'Сессия ВК закончилась, войди снова') }
      if (code === 14 && json.error.captcha_sid && attempt < 4) {
        const key = await this.o.onCaptcha(json.error.captcha_sid, json.error.captcha_img ?? '')
        extra.captcha_sid = json.error.captcha_sid
        extra.captcha_key = key
        continue
      }
      throw new VkError(code, error_msg ?? 'Ошибка ВК')
    }
  }
}
