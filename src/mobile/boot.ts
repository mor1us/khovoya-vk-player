// Точка входа телефонной сборки: сперва мост, только потом окно —
// иначе окно сделает первый запрос в пустоту.
import { startMobile } from './index'

await startMobile()
await import('../renderer/main')
