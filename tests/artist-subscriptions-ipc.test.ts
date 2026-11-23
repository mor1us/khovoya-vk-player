import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerArtistSubscriptions } from '../src/main/ipc/artistSubscriptions'

const services = vi.hoisted(() => ({
  handle: vi.fn(),
  loadVk: vi.fn(),
  openVk: vi.fn()
}))

vi.mock('../src/main/ipc/handlers', () => ({ handle: services.handle }))
vi.mock('../src/main/vk/webArtists', () => ({
  vkWebSubscriptions: services.loadVk,
  vkSubscriptionsWindow: services.openVk
}))

const invoke = (channel: string, ...args: unknown[]) => services.handle.mock.calls.find(([name]) => name === channel)![1](...args)

beforeEach(() => { vi.resetAllMocks() })

describe('каналы подписок Windows', () => {
  it('ждёт закрытия одного окна восстановления ВК и продолжает загрузку SoundCloud', async () => {
    let closeWindow!: () => void
    services.openVk.mockReturnValue(new Promise<void>((resolve) => { closeWindow = resolve }))
    services.loadVk.mockResolvedValue([{ id: '42', name: 'Артист ВК' }])
    const soundCloudSubscriptions = vi.fn().mockResolvedValue([{ id: 'sc', name: 'Артист SoundCloud' }])
    registerArtistSubscriptions({ window: () => null, vkUserId: () => 17, soundCloudSubscriptions, mock: false })

    const firstWindow = invoke('vk:openSubscriptions')
    expect(invoke('vk:openSubscriptions')).toBe(firstWindow)
    expect(services.openVk).toHaveBeenCalledTimes(1)
    const loadingVk = invoke('artists:subscriptions', 'vk')
    expect(services.loadVk).not.toHaveBeenCalled()
    await expect(invoke('artists:subscriptions', 'sc')).resolves.toEqual([{ id: 'sc', name: 'Артист SoundCloud' }])

    closeWindow()
    await expect(loadingVk).resolves.toEqual([{ id: '42', name: 'Артист ВК' }])
    expect(services.loadVk).toHaveBeenCalledOnce()
    expect(services.loadVk).toHaveBeenCalledWith(17)
  })

  it('не отдаёт запоздалый результат, если аккаунт ВК уже сменился', async () => {
    let finishLoad!: (artists: unknown[]) => void
    let account = 17
    services.loadVk.mockReturnValueOnce(new Promise((resolve) => { finishLoad = resolve })).mockResolvedValueOnce([])
    registerArtistSubscriptions({ window: () => null, vkUserId: () => account, soundCloudSubscriptions: async () => null, mock: false })

    const previous = invoke('artists:subscriptions', 'vk')
    account = 29
    await expect(invoke('artists:subscriptions', 'vk')).resolves.toEqual([])
    finishLoad([{ id: '42', name: 'Артист первого аккаунта' }])
    await expect(previous).rejects.toThrow('Аккаунт ВК изменился')
  })
})
