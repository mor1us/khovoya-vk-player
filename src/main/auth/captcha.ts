import { VK_UA } from '../vk/client'

export async function fetchImageDataUrl(f: typeof fetch, url: string): Promise<string> {
  const r = await f(url, { headers: { 'User-Agent': VK_UA } })
  const type = r.headers.get('content-type') || 'image/jpeg'
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
  return `data:${type.startsWith('image/') ? type : 'image/jpeg'};base64,${b64}`
}

/**
 * Ожидание ответа на капчу. Канал ответа регистрируется один раз при старте,
 * а ожидание всегда одно: новая капча закрывает прежнюю пустым ответом, иначе тот
 * запрос к ВК висел бы вечно (его resolve терялся вместе с перерегистрацией канала).
 * Если человек ничего не ввёл, через timeoutMs отвечаем пусто — ВК сам скажет, что капча не та.
 * Каждое закрытое ожидание отзывается через onDone: окно убирает картинку, чтобы человек не вводил
 * символы в окошко, ответ из которого уже никому не нужен.
 */
export class CaptchaGate {
  private resolve: ((key: string) => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private timeoutMs = 3 * 60_000, private onDone: () => void = () => {}) {}

  get waiting(): boolean { return this.resolve !== null }

  /** show() показывает картинку в окне; ответ придёт из answer() или по таймауту. */
  ask(show: () => void): Promise<string> {
    this.answer('') // прежнее ожидание — закрыть, чтобы не висело
    return new Promise<string>((res) => {
      this.resolve = res
      this.timer = setTimeout(() => this.answer(''), this.timeoutMs)
      show()
    })
  }

  /** Ответ из окна. Лишние вызовы (никто не ждёт) ничего не делают. */
  answer(key: string): void {
    const res = this.resolve
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this.resolve = null
    if (!res) return // никто не ждёт — и окну сообщать нечего
    res(typeof key === 'string' ? key : '')
    this.onDone()
  }

  /** Окно закрылось — ждать больше нечего. */
  cancel(): void { this.answer('') }
}
