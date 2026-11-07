import { Preferences } from '@capacitor/preferences'
import { installBridge, askCaptcha, emit } from './bridge'
import { prefsStore } from './storage'
import { makeVkApi } from './vkApi'
import { nativeFetch, login as nativeLogin, logout as nativeLogout, playback, webUserAgent, downloadApk, installApk, nativeShell } from './native'
import { makeUpdates } from './updates'
import { version as CURRENT } from '../../package.json'
import { setPlatform } from '../renderer/ui/layout'
import { useUi } from '../renderer/store/ui'
import { usePhoneStage } from '../renderer/ui/PhoneStage'
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
  // прибивает документ: ездить должны списки, а не вся страница целиком
  document.documentElement.classList.add('phone-root')
  const store = await prefsStore(Preferences)
  const ua = await webUserAgent()
  const vk = makeVkApi({
    fetch: nativeFetch,
    onCaptcha: askCaptcha,
    onAuthLost: () => emit('auth:lost'),
    log,
    webUa: () => ua
  })

  // На компьютере обновлениями занимается electron-updater; здесь то же самое руками.
  const updates = makeUpdates({
    current: CURRENT,
    owner: 'mor1us',
    repo: 'khovoya-vk-player',
    fetch: nativeFetch,
    download: downloadApk,
    install: installApk,
    onChange: (s) => emit('upd:changed', s),
    log
  })
  // смотрим один раз при запуске — чтобы новая версия не ждала, пока ты зайдёшь в настройки
  setTimeout(() => void updates.check(), 4000)

  // кнопка «назад»: сперва свернуть плеер, потом вернуться по экранам,
  // и только если возвращаться некуда — свернуть приложение
  void nativeShell(() => {
    if (usePhoneStage.getState().open) { usePhoneStage.setState({ open: false }); return true }
    if (useUi.getState().history.length) { useUi.getState().back(); return true }
    return false
  })

  let playingNow = false
  installBridge({
    updates,
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
