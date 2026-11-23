import type { BrowserWindow } from 'electron'
import type { ArtistSubscription } from '../../shared/types'
import { vkSubscriptionsWindow, vkWebSubscriptions } from '../vk/webArtists'
import { handle } from './handlers'

type Options = {
  window: () => BrowserWindow | null
  vkUserId: () => number
  soundCloudSubscriptions: () => Promise<ArtistSubscription[] | null>
  mock: boolean
}

export function registerArtistSubscriptions(options: Options) {
  let recovery: Promise<void> | undefined
  let request: { userId: number; list: ReturnType<typeof vkWebSubscriptions> } | undefined

  handle('vk:openSubscriptions', () => {
    if (options.mock) return
    const userId = options.vkUserId()
    if (!userId) throw new Error('Войди в ВК, чтобы открыть подписки')
    recovery ??= vkSubscriptionsWindow(options.window(), userId).finally(() => { recovery = undefined })
    return recovery
  })

  handle('artists:subscriptions', async (source) => {
    if (source === 'sc') return options.soundCloudSubscriptions()
    if (options.mock) return []
    if (recovery) await recovery
    const userId = options.vkUserId()
    if (!userId) return null
    if (request?.userId === userId) return request.list

    const list = vkWebSubscriptions(userId).then((artists) => {
      if (options.vkUserId() !== userId) throw new Error('Аккаунт ВК изменился. Обнови подписки.')
      return artists
    }).finally(() => {
      if (request?.list === list) request = undefined
    })
    request = { userId, list }
    return list
  })
}
