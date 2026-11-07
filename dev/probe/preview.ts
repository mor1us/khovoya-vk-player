// ВЫБРАСЫВАЕМЫЙ КОД: телефонный вид Хвои для просмотра на компьютере.
// Вместо ВК — заглушка, вместо Capacitor — объявленная вручную платформа.
import './stub'
import { setPlatform } from '../../src/renderer/ui/layout'

setPlatform('android')
await import('../../src/renderer/main')
