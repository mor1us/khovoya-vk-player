/**
 * Подготовка приложения не должна мешать окну открыться: если что-то в ней упало,
 * пишем это в журнал и показываем человеку, но окно всё равно создаём — иначе
 * Хвоя остаётся висеть в процессах без окна и без трея, и выглядит это как «ничего не произошло».
 */
export async function bootSafely(steps: () => Promise<void>, onError: (e: unknown) => void): Promise<boolean> {
  try {
    await steps()
    return true
  } catch (e) {
    onError(e)
    return false
  }
}
