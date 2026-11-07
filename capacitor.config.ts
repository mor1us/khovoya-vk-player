import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.morius.khvoya',
  appName: 'Хвоя',
  webDir: 'dist/mobile',
  // чёрный фон окна: пока грузится интерфейс, не должно быть белой вспышки
  backgroundColor: '#0B0B0B',
  android: {
    // ВК отдаёт всё по https — смешанного содержимого быть не должно
    allowMixedContent: false,
    backgroundColor: '#0B0B0B'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0B0B0B',
      androidSplashResourceName: 'splash',
      showSpinner: false
    }
  }
}

export default config
