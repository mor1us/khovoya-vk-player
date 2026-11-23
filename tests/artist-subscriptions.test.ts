import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArtistSubscription } from '../src/shared/types'
import { useArtistSubscriptions } from '../src/renderer/store/artistSubscriptions'
import { vkSubscriptionMessages } from '../src/shared/vkSubscriptionStatus'

const artist = (name: string): ArtistSubscription => ({ id: name, name })

afterEach(() => {
  vi.unstubAllGlobals()
  useArtistSubscriptions.setState({ vk: null, sc: null })
})

describe('подписки аккаунтов', () => {
  it('заменяет список ВК, включая удалённых артистов, и держит SoundCloud отдельно', async () => {
    const invoke = vi.fn().mockResolvedValueOnce([artist('Hxlkart')]).mockResolvedValueOnce([artist('SC')]).mockResolvedValueOnce([])
    vi.stubGlobal('window', { api: { invoke } })
    const { load } = useArtistSubscriptions.getState()
    await load('vk', 10)
    await load('sc', 20)
    expect(await load('vk', 10)).toEqual([artist('Hxlkart')])
    expect(invoke).toHaveBeenCalledTimes(2)
    await load('vk', 10, true)
    expect(useArtistSubscriptions.getState().vk).toMatchObject({ account: 10, artists: [], status: 'ready' })
    expect(useArtistSubscriptions.getState().sc).toMatchObject({ account: 20, artists: [artist('SC')] })
  })

  it('не показывает результат предыдущего аккаунта после смены пользователя', async () => {
    let finishFirst: (artists: ArtistSubscription[]) => void = () => {}
    const first = new Promise<ArtistSubscription[]>((resolve) => { finishFirst = resolve })
    const invoke = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce([artist('Другой артист')])
    vi.stubGlobal('window', { api: { invoke } })
    const { load } = useArtistSubscriptions.getState()
    const old = load('vk', 10)
    await load('vk', 11)
    finishFirst([artist('Hxlkart')])
    await old
    expect(useArtistSubscriptions.getState().vk).toMatchObject({ account: 11, artists: [artist('Другой артист')] })
  })

  it('сохраняет список и причину сбоя ВК, ручное обновление остаётся доступно', async () => {
    const failure = new Error(`Error invoking remote method 'artists:subscriptions': Error: ${vkSubscriptionMessages.verification}`)
    const invoke = vi.fn().mockResolvedValueOnce([artist('Hxlkart')]).mockRejectedValueOnce(failure).mockResolvedValueOnce([artist('ximora')])
    vi.stubGlobal('window', { api: { invoke } })
    const { load } = useArtistSubscriptions.getState()
    await load('vk', 10)
    await expect(load('vk', 10, true)).rejects.toThrow(vkSubscriptionMessages.verification)
    expect(useArtistSubscriptions.getState().vk).toMatchObject({
      account: 10, artists: [artist('Hxlkart')], status: 'failed', reason: 'verification'
    })
    expect(await load('vk', 10)).toEqual([artist('Hxlkart')])
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(await load('vk', 10, true)).toEqual([artist('ximora')])
  })
})
