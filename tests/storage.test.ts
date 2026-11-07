import { describe, it, expect } from 'vitest'
import { makeSettings, type Slot } from '../src/shared/store'
import { defaultSettings } from '../src/main/system/settingsLogic'
import { memStore, slotFrom } from '../src/mobile/storage'

const def = () => defaultSettings('/музыка/Хвоя')

function slots(init: Record<string, unknown> = {}) {
  const store = memStore(init)
  return {
    store,
    settings: slotFrom<unknown>(store, 'settings', null),
    migrations: slotFrom<Record<string, boolean>>(store, 'migrations', {})
  }
}

describe('настройки поверх подставного хранилища', () => {
  it('на пустом хранилище отдаёт значения по умолчанию', () => {
    const s = slots()
    expect(makeSettings(s.settings, s.migrations, def).get()).toEqual(def())
  })

  it('записанное читается обратно', () => {
    const s = slots()
    const st = makeSettings(s.settings, s.migrations, def)
    st.set({ crossfadeSec: 7 })
    expect(makeSettings(s.settings, s.migrations, def).get().crossfadeSec).toBe(7)
  })

  it('миграция кроссфейда: 6 с превращается в 3 с', () => {
    const s = slots({ settings: { ...def(), crossfadeSec: 6 } })
    expect(makeSettings(s.settings, s.migrations, def).get().crossfadeSec).toBe(3)
  })

  it('миграция делается один раз: выбранные 6 с переживают перезапуск', () => {
    const s = slots({ settings: { ...def(), crossfadeSec: 6 } })
    makeSettings(s.settings, s.migrations, def)
    const again = makeSettings(s.settings, s.migrations, def)
    again.set({ crossfadeSec: 6 })
    expect(makeSettings(s.settings, s.migrations, def).get().crossfadeSec).toBe(6)
  })

  it('мусор в хранилище не роняет настройки', () => {
    const s = slots({ settings: { crossfadeSec: 'много', animations: 'да' } })
    const got = makeSettings(s.settings, s.migrations, def).get()
    expect(got.crossfadeSec).toBe(def().crossfadeSec)
    expect(got.animations).toBe(def().animations)
  })

  it('об изменении сообщает подписчику', () => {
    const s = slots()
    const st = makeSettings(s.settings, s.migrations, def)
    let got = 0
    st.onChange((n) => { got = n.crossfadeSec })
    st.set({ crossfadeSec: 5 })
    expect(got).toBe(5)
  })
})

describe('Slot поверх памяти', () => {
  it('пишет и читает', () => {
    const slot: Slot<number> = slotFrom(memStore(), 'n', 0)
    expect(slot.read()).toBe(0)
    slot.write(42)
    expect(slot.read()).toBe(42)
  })
})
