# Хвоя на Android (ядро) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android-приложение «Хвоя»: вход в ВК, своя музыка, поиск, плейлисты, Волна и плеер, который играет при погашенном экране и показывает трек на экране блокировки.

**Architecture:** Capacitor. Окно `src/renderer/` живёт в Android WebView без единой правки логики; `src/mobile/` — вторая реализация тех же каналов `src/shared/ipc.ts`; `src/main/vk/*` и `webToken.ts` переиспользуются как есть. Нативного кода на Kotlin ровно три куска: HTTP с настоящим `User-Agent`, экран входа на WebView, фоновая служба с MediaSession.

**Tech Stack:** Capacitor 6, TypeScript (strict), React 18, Zustand, Kotlin, Vitest, Gradle, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-06-android-core-design.md`

## Global Constraints

- Нижняя планка — **Android 13** (`minSdk 33`), цель сборки — последняя стабильная.
- **Вход только через сайт ВК в WebView.** Вход по логину и паролю через `oauth.vk.com/token` с чужим `client_id` (Kate Mobile и подобные) запрещён: ВК закрыла этот путь в сентябре 2026. Пароль через Хвою не проходит.
- **`src/main/vk/*`, `src/main/auth/webToken.ts`, `src/main/system/settingsLogic.ts` не копируются в `src/mobile/`, а импортируются.** Мешает импорту — файл разделяют на расчёт и платформенную часть.
- Окно не знает, где работает: никаких проверок платформы в `src/renderer/store/`, `player/`, `wave/`. Платформа влияет только на то, какая реализация `window.api` подставлена и какая раскладка показана.
- Канал из `IPC`, не поддержанный на телефоне, **отвечает, а не падает**.
- Ошибки наружу — по-русски, без технических кодов, через общий `friendly()`.
- Ключи доступа не попадают в журнал: только через `log()` с `redact()`.
- Весь текст для человека — по-русски, на «ты».
- Стиль кода: двойных кавычек нет, точек с запятой нет, 2 пробела. Комментарии по-русски, объясняют «почему».
- Палитра и шрифты — как в корневом `CLAUDE.md`, телефонная версия своих цветов не заводит.
- `npm run check` зелёный после каждой задачи.

## Review Focus

- **Поворот экрана и сворачивание.** Android по умолчанию пересоздаёт Activity при повороте — WebView перезагрузится, музыка оборвётся, очередь исчезнет. В манифесте нужен `configChanges` на ориентацию, размер экрана и плотность (тест руками в Task 1, запись в манифесте — там же).
- **Нет сети при запуске.** Окно не должно вставать белым экраном: каналы отвечают «Нет подключения», интерфейс рисуется пустым (тест в Task 5).
- **Ключ ВК протух при погашенном экране.** `TokenKeeper` обновляет ключ нативным запросом без WebView; если сессия кончилась — музыка не обрывается молча, а при возврате в приложение видно «Сессия ВК закончилась, войди снова» (тест в Task 6).
- **Систему попросили убить фоновую службу.** При возврате в приложение плеер показывает честное состояние, а не делает вид, что играет (тест в Task 8).
- **ВК просит капчу.** Событие `vk:captcha` приходит, когда экрана входа нет; на телефоне ему нужно место, иначе запрос виснет навсегда (тест в Task 6).

---

### Task 1: Голый apk и ответ на главный риск

Первая задача не строит приложение, а отвечает на вопрос, от которого зависит вся затея: переживёт ли звук в WebView погашенный экран. Пока ответа нет, остальные задачи начинать нельзя.

**Files:**
- Create: `android/` (проект Capacitor, `npx cap add android`)
- Create: `android/app/src/main/java/ru/morius/khvoya/PlaybackService.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `package.json` (скрипты `build:mobile`, `dist:android`; зависимости `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/preferences`)
- Create: `capacitor.config.ts`
- Create: `dev/probe/background.html` — страница с одним `<audio>` и кнопкой «играть»

**Interfaces:**
- Consumes: ничего
- Produces: `android/` проект, скрипт `npm run build:mobile`, класс `PlaybackService` (пустая фоновая служба с уведомлением)

- [ ] **Step 1: Завести проект Capacitor**

`capacitor.config.ts`: `appId: 'ru.morius.khvoya'`, `appName: 'Хвоя'`, `webDir: 'dist/mobile'`, `android.allowMixedContent: false`.

- [ ] **Step 2: Собрать окно в `dist/mobile`**

Скрипт `build:mobile` = `vite build --config vite.mobile.config.ts && cap sync android`. Конфиг повторяет `dev/probe/vite.config.ts` (он уже работает), но вместо заглушки подставляет `src/mobile/bridge.ts` — на этом шаге его ещё нет, поэтому временно оставить заглушку из `dev/probe/stub.ts` и пометить комментарием, что её убирает Task 5.

- [ ] **Step 3: Запретить пересоздание Activity**

В `AndroidManifest.xml` у главной Activity: `android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|smallestScreenSize|density"`. Без этого поворот телефона перезагружает WebView и обрывает музыку.

- [ ] **Step 4: Минимальная фоновая служба**

`PlaybackService` — `startForeground` с уведомлением «Хвоя играет», тип `mediaPlayback`, разрешения `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `WAKE_LOCK`. Служба пока ничего не умеет, только живёт.

- [ ] **Step 5: Собрать отладочный apk**

Run: `npm run build:mobile && cd android && ./gradlew assembleDebug`
Expected: `android/app/build/outputs/apk/debug/app-debug.apk`

- [ ] **Step 6: Проверить на телефоне**

Поставить apk, открыть `background.html`, запустить трек и проверить:
1. музыка играет минуту при погашенном экране;
2. поворот телефона не обрывает музыку;
3. переключение в другое приложение не обрывает музыку.

**Если первый пункт не прошёл** — остановиться и сообщить Мориусу: дальше идёт отступление на нативный Media3 (меняется только `src/renderer/player/engine.ts`), и план с этого места переписывается.

- [ ] **Step 7: Commit**

```bash
git add android capacitor.config.ts package.json package-lock.json vite.mobile.config.ts dev/probe/background.html
git commit -m "Android: проект Capacitor и проверка фона"
```

---

### Task 2: `registerCore` без Electron

**Files:**
- Create: `src/main/ipc/registerCore.ts`
- Create: `src/shared/friendly.ts`
- Modify: `src/main/ipc/handlers.ts`
- Test: `tests/register-core.test.ts`

**Interfaces:**
- Consumes: `AudioApi` из `src/main/vk/audio.ts`
- Produces:
  - `type Handle = <C extends Channel>(ch: C, fn: (...a: IpcArgs<C>) => IpcResult<C> | Promise<IpcResult<C>>) => void`
  - `registerCore(c: Ctx, handle: Handle): void` — `Ctx` теряет поле `win`, вместо него `window: { min(): void; max(): void; close(): void }`
  - `friendly(e: unknown): Error` в `src/shared/friendly.ts`

- [ ] **Step 1: Write the failing test**

`tests/register-core.test.ts`: `registerCore` с подставным `handle`, который складывает каналы в `Map`.

```ts
it('регистрирует все каналы ВК и плейлистов без Electron', () => {
  const seen = new Map<string, unknown>()
  registerCore(ctx, (ch, fn) => { seen.set(ch, fn) })
  for (const c of ['vk:myTracks', 'vk:search', 'vk:byId', 'pl:create', 'pl:reorder', 'auth:session', 'win:close']) expect(seen.has(c)).toBe(true)
})
it('зовёт AudioApi, а не ходит в сеть сам', async () => {
  // myTracks подставлен и возвращает один трек — проверяем, что канал отдаёт именно его
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/register-core.test.ts`
Expected: FAIL — модуля `src/main/ipc/registerCore.ts` нет

- [ ] **Step 3: Вынести `registerCore` и `friendly`**

Перенести тело `registerCore` из `src/main/ipc/handlers.ts` в `src/main/ipc/registerCore.ts`, заменив `c.win()?.minimize()` на `c.window.min()` и так для `max` и `close`. `friendly()` перенести в `src/shared/friendly.ts` без изменений. `handlers.ts` оставляет себе только `handle` поверх `ipcMain` и реэкспорт.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/register-core.test.ts && npm run check`
Expected: PASS, 223+ тестов зелёные

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc src/shared/friendly.ts src/main/index.ts tests/register-core.test.ts
git commit -m "Таблица каналов отделена от Electron"
```

---

### Task 3: Хранилище под две платформы

**Files:**
- Create: `src/shared/store.ts`
- Create: `src/mobile/storage.ts`
- Modify: `src/main/system/jsonFile.ts`
- Modify: `src/main/system/settings.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `defaultSettings`, `normalizeSettings`, `migrateSettings` из `src/main/system/settingsLogic.ts`
- Produces:
  - `type Slot<T> = { read(): T; write(v: T): void }` в `src/shared/store.ts`
  - `makeSettings(slot: Slot<unknown>, migSlot: Slot<Record<string, boolean>>, def: () => Settings)` — то, что сейчас делает `settings` в `settings.ts`, но без Electron
  - `prefsSlot<T>(name: string, fallback: () => T): Slot<T>` в `src/mobile/storage.ts`

- [ ] **Step 1: Write the failing test**

`tests/storage.test.ts`: на подставном `Slot` в памяти проверить, что `makeSettings` отдаёт значения по умолчанию на пустом хранилище, применяет миграцию кроссфейда (`6 → 4 → 3`, значения из `settingsLogic.ts`), и что повторное чтение не теряет записанное.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL — `makeSettings` не определён

- [ ] **Step 3: Реализовать**

`makeSettings` — перенос тела `settings` из `settings.ts` с заменой `jsonFile(...)` на переданные `Slot`. `jsonFile` остаётся файловой реализацией `Slot`. `prefsSlot` читает и пишет `Preferences` Capacitor; `Preferences` асинхронный, поэтому значения один раз загружаются при старте в память, а запись идёт следом — `Slot` остаётся синхронным, иначе `settings.get()` пришлось бы править в десятке мест окна.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage.test.ts && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/store.ts src/mobile/storage.ts src/main/system tests/storage.test.ts
git commit -m "Хранилище настроек не зависит от платформы"
```

---

### Task 4: Канал `now:update` вместо `discord:update`

**Files:**
- Modify: `src/shared/ipc.ts` (в `IpcMap` и в `IPC`)
- Modify: `src/main/index.ts:247`
- Rename: `src/renderer/store/discord.ts` → `src/renderer/store/now.ts` (функция `bindDiscord` → `bindNow`)
- Modify: `src/renderer/App.tsx` (вызов `bindDiscord`)
- Modify: `tests/discord.test.ts` → `tests/now.test.ts`, `tests/ipc.test.ts`

**Interfaces:**
- Produces: канал `'now:update': (u: NowPlaying) => void`, где `NowPlaying` — нынешний `DiscordUpdate`, переименованный в `src/shared/types.ts`

- [ ] **Step 1: Переименовать в тесте**

В `tests/ipc.test.ts` в списке каналов заменить `discord:update` на `now:update`; `tests/discord.test.ts` переименовать в `tests/now.test.ts` и поправить имена.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ipc.test.ts tests/now.test.ts`
Expected: FAIL — канала `now:update` нет

- [ ] **Step 3: Переименовать канал и тип**

`DiscordUpdate` → `NowPlaying` в `src/shared/types.ts` (поля те же: `{ track: Track | null; playing: boolean; position: number }`). Discord на компьютере остаётся — меняется только имя канала, который его кормит.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -am "Окно сообщает, что играет, а не кормит Discord"
```

---

### Task 5: Мобильный мост

**Files:**
- Create: `src/mobile/bridge.ts`
- Create: `src/mobile/index.ts` (точка входа мобильной сборки)
- Modify: `vite.mobile.config.ts` (вместо заглушки из Task 1 — настоящий мост)
- Test: `tests/mobile-bridge.test.ts`

**Interfaces:**
- Consumes: `registerCore`, `Handle` (Task 2), `makeSettings`, `prefsSlot` (Task 3)
- Produces: `installBridge(deps: BridgeDeps): void` — ставит `window.api = { invoke, on }`; `BridgeDeps = { api: AudioApi; session(): Promise<Session>; logout(): void }`

- [ ] **Step 1: Write the failing test**

`tests/mobile-bridge.test.ts`:

```ts
it('отвечает на каждый канал из IPC', async () => {
  installBridge(deps)
  for (const ch of Object.keys(IPC)) await expect(window.api.invoke(ch as Channel)).resolves.not.toThrow()
})
it('неподдержанные каналы отвечают, а не падают', async () => {
  await expect(window.api.invoke('upd:state')).resolves.toEqual({ stage: 'idle' })
  await expect(window.api.invoke('sc:status')).resolves.toMatchObject({ ok: false, hasKey: false })
  await expect(window.api.invoke('win:close')).resolves.toBeUndefined()
})
it('ошибку сети переводит в понятную фразу', async () => {
  // api.myTracks бросает Error('fetch failed') — канал отдаёт «Нет подключения»
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mobile-bridge.test.ts`
Expected: FAIL — `installBridge` не определён

- [ ] **Step 3: Реализовать мост**

`installBridge` собирает таблицу через `registerCore(ctx, handle)` с `handle`, складывающим функции в `Map`, добавляет заглушки для `upd:*`, `sc:*`, `scacc:*`, `dl:*`, `win:*`, `settings:pickDir`, `discord`-остатков, оборачивает всё в `friendly()` и ставит `window.api`. `on()` возвращает отписку и работает поверх своей шины событий — через неё Task 6 пришлёт `vk:captcha` и `auth:lost`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mobile-bridge.test.ts && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mobile tests/mobile-bridge.test.ts vite.mobile.config.ts
git commit -m "Мобильный мост отвечает на все каналы"
```

---

### Task 6: ВК на телефоне — нативный HTTP и ключ

**Files:**
- Create: `android/app/src/main/java/ru/morius/khvoya/HttpPlugin.kt`
- Create: `src/mobile/native.ts`
- Create: `src/mobile/vkApi.ts`
- Test: `tests/mobile-vk.test.ts`

**Interfaces:**
- Consumes: `VkClient`, `VK_UA` из `src/main/vk/client.ts`; `VkAudioApi` из `audio.ts`; `TokenKeeper`, `webTokenRequest`, `parseWebToken` из `src/main/auth/webToken.ts`
- Produces:
  - `nativeFetch: typeof fetch` в `src/mobile/native.ts` — тот же договор, что у `fetch`, но запрос уходит из Kotlin
  - `makeVkApi(deps: { onCaptcha(sid: string, img: string): Promise<string>; onAuthLost(): void; log(m: string): void }): { api: AudioApi; keeper: TokenKeeper }`

- [ ] **Step 1: Write the failing test**

`tests/mobile-vk.test.ts` — на подставном `nativeFetch`, настоящей сети не касаемся:

```ts
it('шлёт User-Agent официального приложения', async () => {
  // подставной fetch записывает заголовки; проверяем VK_UA и X-VK-Android-Client
})
it('ключ берёт у TokenKeeper и обновляет без WebView', async () => {
  // fetchToken вызван ровно один раз на два запроса подряд
})
it('капча уходит в onCaptcha и запрос повторяется с ответом', async () => {
  // первый ответ — error_code 14, второй — успех; проверяем captcha_key во втором запросе
})
it('сессия кончилась — onAuthLost вызван, наружу понятная фраза', async () => {
  // error_code 5 дважды подряд
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mobile-vk.test.ts`
Expected: FAIL — `makeVkApi` не определён

- [ ] **Step 3: Нативный HTTP**

`HttpPlugin.kt` — метод `request(url, method, headers, body)`, возвращает `{ status, body }`. Заголовки ставятся как есть, включая `User-Agent`: именно ради этого плагин и нужен. Cookie берутся из общего `CookieManager`, чтобы запрос за ключом видел вошедшую сессию.

- [ ] **Step 4: Собрать `makeVkApi`**

`nativeFetch` оборачивает плагин в договор `fetch`. `makeVkApi` собирает `TokenKeeper` поверх `webTokenRequest` + `parseWebToken` на `nativeFetch`, затем `VkClient` с этим `fetch`, затем `VkAudioApi`. Ни одна из этих функций не копируется — все импортируются.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/mobile-vk.test.ts && npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java src/mobile tests/mobile-vk.test.ts
git commit -m "ВК на телефоне: нативный HTTP и обновление ключа без окна"
```

---

### Task 7: Экран входа в ВК

**Files:**
- Create: `android/app/src/main/java/ru/morius/khvoya/LoginPlugin.kt`
- Modify: `src/mobile/native.ts` (метод `login()`)
- Modify: `src/mobile/bridge.ts` (каналы `auth:browser`, `auth:logout`)
- Test: `tests/mobile-auth.test.ts`

**Interfaces:**
- Consumes: `webTokenScript`, `pageTld`, `WEB_UA`, `parseWebToken` из `src/main/auth/webToken.ts`
- Produces: `native.login(): Promise<WebToken | { error: string }>`; каналы `auth:browser` и `auth:session` отвечают по-настоящему

- [ ] **Step 1: Write the failing test**

`tests/mobile-auth.test.ts` — на подставном `native.login`:

```ts
it('успешный вход отдаёт имя и сохраняет ключ в TokenKeeper', async () => {})
it('закрытый экран входа отдаёт понятную фразу, а не падает', async () => {})
it('auth:logout чистит ключ и cookie', async () => {})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mobile-auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Экран входа на Kotlin**

`LoginPlugin` открывает Activity с WebView: `userAgentString = WEB_UA`, адрес `https://vk.com/`. На каждом `onPageFinished` и раз в 2 секунды выполняет `webTokenScript(tld)` через `evaluateJavascript`, где `tld` определяется по адресу страницы (та же логика, что `pageTld`). Пришёл ключ — Activity закрывается и отдаёт его. Закрыл сам — `{ error: 'Окно входа закрыто' }`. Это повторение `loginWindow` из `webSession.ts`, но на Android.

- [ ] **Step 4: Связать с мостом**

`auth:browser` зовёт `native.login()`, кладёт ключ в `TokenKeeper`, тянет имя через `users.get` и отдаёт `LoginStep`. `auth:logout` чистит `TokenKeeper` и cookie в `CookieManager`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/mobile-auth.test.ts && npm run check`
Expected: PASS

- [ ] **Step 6: Проверить на телефоне**

Вход с нуля, вход после перезапуска приложения, выход. В журнале ключей быть не должно.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java src/mobile tests/mobile-auth.test.ts
git commit -m "Вход в ВК через сайт на телефоне"
```

---

### Task 8: Фоновая служба и экран блокировки

**Files:**
- Modify: `android/app/src/main/java/ru/morius/khvoya/PlaybackService.kt`
- Create: `android/app/src/main/java/ru/morius/khvoya/MediaPlugin.kt`
- Modify: `src/mobile/bridge.ts` (канал `now:update`)
- Test: `tests/mobile-now.test.ts`

**Interfaces:**
- Consumes: канал `now:update` и тип `NowPlaying` (Task 4)
- Produces: `native.updateNow(n: NowPlaying): void`; события `tray:cmd` (`'toggle' | 'next'`) приходят в окно из кнопок на экране блокировки и наушниках — канал уже есть в `EventMap`

- [ ] **Step 1: Write the failing test**

`tests/mobile-now.test.ts`:

```ts
it('now:update доходит до нативной стороны', async () => {})
it('пустой трек гасит уведомление', async () => {
  // { track: null } — updateNow вызван с null, служба останавливается
})
it('кнопка на экране блокировки приходит окну событием tray:cmd', () => {})
it('служба убита — плеер показывает паузу, а не мнимое воспроизведение', async () => {
  // нативная сторона отвечает playing: false, хотя store думает, что играет
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mobile-now.test.ts`
Expected: FAIL

- [ ] **Step 3: Служба с MediaSession**

`PlaybackService` обзаводится `MediaSessionCompat`: название, исполнитель, обложка (качается по `coverUrl`), позиция, кнопки «пауза», «назад», «вперёд». Нажатия уходят в окно событием `tray:cmd` — окно уже умеет его слушать, это тот же канал, которым на компьютере командует трей. Аудиофокус: пауза при звонке, пауза при вынутых наушниках, приглушение поверх навигатора.

- [ ] **Step 4: Честное состояние после убийства службы**

При возвращении в приложение окно спрашивает нативную сторону, играет ли звук на самом деле, и приводит плеер в соответствие вместо того, чтобы показывать воспроизведение, которого нет.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/mobile-now.test.ts && npm run check`
Expected: PASS

- [ ] **Step 6: Проверить на телефоне**

Все шесть пунктов из раздела 10 спеки: вход, минута с погашенным экраном, кнопка на наушниках, входящий звонок, вынутые наушники, обложка на экране блокировки.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java src/mobile tests/mobile-now.test.ts
git commit -m "Фоновая служба и экран блокировки"
```

---

### Task 9: Раскладка под палец

**Files:**
- Create: `src/renderer/ui/BottomBar.tsx`
- Create: `src/renderer/ui/PhoneStage.tsx`
- Modify: `src/renderer/App.tsx` (выбор раскладки)
- Modify: `src/renderer/ui/TrackRow.tsx` (долгое нажатие, высота ряда)
- Modify: `src/renderer/pages/Settings.tsx` (прячет поля, которых на телефоне нет)
- Test: `tests/layout.test.ts`

**Interfaces:**
- Consumes: store плеера и навигации — без изменений
- Produces: `pickLayout(platform: string): 'desktop' | 'phone'` в `src/renderer/ui/layout.ts`, зовётся один раз при старте

- [ ] **Step 1: Write the failing test**

`tests/layout.test.ts`: `pickLayout(platform)` отдаёт `'phone'` для `'android'` и `'desktop'` для остального; **узкое окно на компьютере остаётся `'desktop'`** — это и есть смысл теста.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/layout.test.ts`
Expected: FAIL

- [ ] **Step 3: Реализовать раскладку**

`BottomBar` — 4 кнопки: Главная, Моё, Поиск, Плейлисты. `PhoneStage` — полоска над панелью, по нажатию на весь экран, свайп вниз сворачивает. Кнопки окна (`win:*`) на телефоне не рисуются. Зона нажатия от 48 пикселей, меню трека по долгому нажатию.

На экране настроек при `layout === 'phone'` прячутся `downloadDir`, `closeToTray`, `discordEnabled`, `discordAppId` — остаются анимации, кроссфейд и выход. Из типа `Settings` поля не убираются: тип общий, компьютерной Хвое они нужны.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/layout.test.ts && npm run check`
Expected: PASS

- [ ] **Step 5: Показать Мориусу**

Собрать 2–3 варианта нижней панели и раскрытого плеера, снять с телефонного экрана и показать. Вид утверждает он, а не план.

- [ ] **Step 6: Commit**

```bash
git add src/renderer tests/layout.test.ts
git commit -m "Раскладка под палец"
```

---

### Task 10: Подпись apk и релиз

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `android/app/build.gradle`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm run build:mobile` (Task 1)
- Produces: apk в релизе GitHub рядом с `Khvoya-Setup-*.exe` и `Khvoya-Portable-*.exe`

- [ ] **Step 1: Подпись**

`build.gradle` читает ключ из переменных окружения (`ANDROID_KEYSTORE` в base64, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). Версия берётся из `package.json`, чтобы не расходилась с установщиком Windows.

- [ ] **Step 2: Работа в Actions**

В `release.yml` добавить работу `android`: JDK 21, Android SDK, `npm run build:mobile`, `./gradlew assembleRelease`, выкладка apk в тот же релиз. Правило «не создавать релиз, если тег `v<version>` уже есть» сохраняется.

- [ ] **Step 3: Записать про ключ в README**

Ключ подписи создаётся один раз и хранится в секретах репозитория. **Потеряешь ключ — обновление поверх установленной Хвои не встанет, придётся сносить и ставить заново.**

- [ ] **Step 4: Проверить**

Поднять `version` в `package.json`, запушить, дождаться релиза, скачать apk на телефон и поставить **поверх** прежней сборки.
Expected: установка поверх проходит, данные и вход на месте.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml android/app/build.gradle README.md
git commit -m "apk собирается и выкладывается в релиз"
```
