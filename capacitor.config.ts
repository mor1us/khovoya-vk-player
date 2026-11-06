import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.morius.khvoya',
  appName: 'Хвоя',
  webDir: 'dist/mobile',
  android: {
    // ВК отдаёт всё по https — смешанного содержимого быть не должно
    allowMixedContent: false
  }
}

export default config
