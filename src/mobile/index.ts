import { Preferences } from '@capacitor/preferences'
import { installBridge, askCaptcha, emit } from './bridge'
import { prefsStore } from './storage'
import { makeVkApi } from './vkApi'
import { nativeFetch, login as nativeLogin, logout as nativeLogout, playback, webUserAgent } from './native'
import { setPlatform } from '../renderer/ui/layout'
import type { LoginStep } from '../shared/types'

/**
 * Точка входа телефонной Хвои: собирает мост и ставит `window.api` до того,
 * как окно сделает первый запрос. Окно о существовании этого файла не знает.
 */
const log = (m: string) => { if (import.meta.env.DEV) console.log(m) }

export async function startMobile() {
  // эта сборка существует только для телефона — раскладку объявляем сразу,
  // не дожидаясь, что скажет Capacitor
  setPlatform('android')
  const store = await prefsStore(Preferences)
  const ua = await webUserAgent()
  const vk = makeVkApi({
    fetch: nativeFetch,
    onCaptcha: askCaptcha,
    onAuthLost: () => emit('auth:lost'),
    log,
    webUa: () => ua
  })

  let playingNow = false
  installBridge({
    api: vk.api,
    store,
    session: vk.session,
    login: async (): Promise<LoginStep> => {
      try {
        const token = await nativeLogin()
        vk.keeper.set(token)
        const s = await vk.session()
        return s.loggedIn ? { kind: 'ok', userName: s.userName ?? 'Ты', avatar: s.avatar } : { kind: 'error', message: 'Войти не вышло, попробуй ещё раз' }
      } catch (e) {
        return { kind: 'error', message: (e as Error).message }
      }
    },
    logout: async () => { vk.keeper.clear(); await nativeLogout() },
    now: (u) => {
      // служба нужна только пока идёт звук — иначе висело бы лишнее уведомление
      if (u.playing !== playingNow) { playingNow = u.playing; void playback(u.playing) }
    },
    log
  })
}
