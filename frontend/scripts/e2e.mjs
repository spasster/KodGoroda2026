// Сквозной сценарий демо в настоящем браузере: pnpm e2e.
//
// По умолчанию проверяет Docker (make up) на http://localhost:8080.
// Другой адрес: BASE_URL=http://localhost:5173 pnpm e2e
//
// В начале сбрасывает базу к data/sample, потому что сценарий начинается со
// спокойной P-01. Если всё прошло, сбрасывает ещё раз, чтобы демо начиналось
// с чистых данных. Если шаг упал, база остаётся как есть, а снимок экрана
// лежит во временной папке, путь печатается.

import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chromium } from 'playwright'
import QRCode from 'qrcode'

const BASE = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')
const ORIGIN = new URL(BASE).origin
const DEMO_FILE = new URL('../../data/sample/demo/intern_S-01_m6.json', import.meta.url)
const WAIT = 10_000

class StepError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const squash = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 300)

function check(ok, message) {
  if (!ok) throw new StepError(message)
}

async function api(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new StepError(`${method} ${path}: нет связи с ${BASE} (${e.cause?.code ?? e.message}). Запущен ли make up?`)
  }
  const text = await res.text()
  check(res.ok, `${method} ${path}: ответ ${res.status} ${squash(text)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    throw new StepError(`${method} ${path}: ответ не JSON: ${squash(text)}`)
  }
}

// Ждём, пока в элементе появится текст. Ошибка говорит, что было на экране.
async function waitText(locator, text, what, timeout = WAIT) {
  const until = Date.now() + timeout
  let seen = ''
  while (Date.now() < until) {
    seen = await locator.first().innerText({ timeout: 1000 }).catch(() => '')
    if (seen.includes(text)) return
    await sleep(150)
  }
  throw new StepError(`${what}: за ${timeout / 1000} с не появилось «${text}». На экране: «${squash(seen) || 'ничего'}»`)
}

async function waitVisible(locator, what, timeout = WAIT) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout })
  } catch {
    throw new StepError(`${what}: не появилось за ${timeout / 1000} с`)
  }
}

// Строка пары в таблице обзора.
const pairRow = (page, id) =>
  page
    .locator('section[aria-labelledby="board-h"] tbody tr')
    .filter({ has: page.getByRole('link', { name: id, exact: true }) })

const nowCell = (page, id) => pairRow(page, id).locator('td').last()

// Путь QR-кода так же, как его строит pages/Form/Qr.tsx.
function qrPath(value) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
  let d = ''
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.data[row * modules.size + col]) d += `M${col} ${row}h1v1h-1z`
    }
  }
  return d
}

const browserErrors = []
function watch(page, name) {
  page.on('pageerror', (e) => browserErrors.push(`${name}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') browserErrors.push(`${name}: ${m.text()}`)
  })
}

let current = ''
let shotPage = null
const started = Date.now()

async function step(name, page, fn) {
  current = name
  shotPage = page
  const t = Date.now()
  await fn()
  console.log(`ok  ${name} (${((Date.now() - t) / 1000).toFixed(1).replace('.', ',')} с)`)
}

console.log(`Сквозной сценарий на ${BASE}\n`)
const browser = await chromium.launch()
let failed = false
let touched = false // база уже сброшена и меняется сценарием

try {
  await step('Бэкенд отвечает, база сброшена к data/sample', null, async () => {
    const health = await api('GET', '/api/health')
    check(health?.ok, `/api/health: ${JSON.stringify(health)}`)
    await api('POST', '/api/admin/reset')
    touched = true
    const overview = await api('GET', '/api/overview')
    const p01 = overview.pairs.find((p) => p.pair_id === 'P-01')
    check(p01, 'В /api/overview нет пары P-01. Это не data/sample?')
    check(p01.status === 'ok', `P-01 после сброса в статусе ${p01.status}, ждали ok`)
  })

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' })
  const dash = await desk.newPage()
  watch(dash, 'дашборд')

  await step('Обзор открылся, P-01 спокойная, поток событий подключён', dash, async () => {
    await dash.goto(BASE + '/')
    await waitVisible(pairRow(dash, 'P-01'), 'Строка P-01 в таблице обзора')
    await waitText(nowCell(dash, 'P-01'), 'Спокойно', 'Колонка «Сейчас» у P-01')
    await waitVisible(dash.getByText('На связи', { exact: false }), 'Лампа «На связи» в шапке')
  })

  await step('POST /api/ingest: демо-анкета S-01 за 6-й месяц', dash, async () => {
    await dash.evaluate(() => {
      window.__e2eNoReload = true
    })
    const body = JSON.parse(await readFile(DEMO_FILE, 'utf8'))
    const res = await api('POST', '/api/ingest', body)
    check(res.pair_id === 'P-01', `Анкета попала в пару ${res.pair_id}, ждали P-01`)
    check(res.new_signals.length > 0, 'Анкета S-01 не дала новых сигналов')
  })

  await step('Без перезагрузки: уведомление, P-01 стала «Пора поговорить»', dash, async () => {
    const toast = dash.getByRole('status').filter({ hasText: 'S-01 прислал анкету за 6-й месяц' })
    await waitVisible(toast, 'Уведомление «Стажёр S-01 прислал анкету за 6-й месяц»')
    await waitText(toast, 'Пора поговорить', 'Уведомление о новой анкете')
    await waitText(nowCell(dash, 'P-01'), 'Пора поговорить', 'Колонка «Сейчас» у P-01')
    const same = await dash.evaluate(() => window.__e2eNoReload === true)
    check(same, 'Страница обзора перезагрузилась, а данные должны были прийти через /api/events')
  })

  await step('Карточка P-03: «Подтвердилось» сохраняется после перезагрузки', dash, async () => {
    await dash.goto(BASE + '/pairs/P-03')
    const confirm = (scope) => scope.getByRole('button', { name: 'Подтвердилось', exact: true })
    const open = dash.locator('article[data-signal]').filter({ has: confirm(dash) })
    await waitVisible(open, 'Открытый сигнал с кнопкой «Подтвердилось» на карточке P-03')
    const key = await open.first().getAttribute('data-signal')
    const saved = dash.waitForResponse(
      (r) => r.request().method() === 'POST' && decodeURIComponent(r.url()).includes(`/api/signals/${key}/review`),
      { timeout: WAIT },
    )
    await confirm(open.first()).click()
    const res = await saved.catch(() => null)
    check(res, `Запрос отметки ${key} не ушёл`)
    check(res.ok(), `Отметка ${key}: ответ ${res.status()}`)

    await dash.reload()
    const block = dash.locator(`article[data-signal="${key}"]`)
    await waitVisible(block, `Сигнал ${key} после перезагрузки`)
    await waitVisible(block.getByRole('button', { name: 'Снять отметку' }), `Кнопка «Снять отметку» у ${key}`)
    await waitText(block, 'Подтвердилось', `Сигнал ${key} после перезагрузки`)
    check((await confirm(block).count()) === 0, `У ${key} после перезагрузки снова кнопка «Подтвердилось»`)
    const pair = await api('GET', '/api/pairs/P-03')
    const signal = pair.signals.find((s) => s.key === key)
    check(signal?.review.status === 'confirmed', `В /api/pairs/P-03 у ${key} отметка ${signal?.review.status}`)
  })

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  })
  const form = await phone.newPage()
  watch(form, 'форма')
  let month = 0

  await step('Форма на 390×844: наставник M-04 отправил анкету, «Спасибо»', form, async () => {
    // Обзор открыт и ждёт уведомление о новой анкете.
    await dash.goto(BASE + '/')
    await waitVisible(pairRow(dash, 'P-04'), 'Строка P-04 в таблице обзора')
    await waitVisible(dash.getByText('На связи', { exact: false }), 'Лампа «На связи» в шапке')

    const people = await api('GET', '/api/people')
    month = people.mentors.find((p) => p.id === 'M-04')?.next_month
    check(month, `У наставника M-04 нет свободного месяца: ${JSON.stringify(people.mentors)}`)

    await form.goto(BASE + '/form')
    await waitVisible(form.getByRole('button', { name: 'Я наставник' }), 'Переключатель «Я наставник»')
    await form.getByRole('button', { name: 'Я наставник' }).click()
    const id = form.locator('label').filter({ has: form.getByRole('radio', { name: 'M-04', exact: true }) })
    await waitVisible(id, 'Кнопка ID M-04')
    await id.click()
    await waitText(form.locator('h1'), `Анкета за ${month}-й месяц`, 'Заголовок формы')

    const groups = form.locator('[role="radiogroup"][aria-labelledby^="form-qt-"]')
    const n = await groups.count()
    check(n > 0, 'В форме наставника нет вопросов со шкалой')
    for (let i = 0; i < n; i++) {
      await groups.nth(i).locator('label').filter({ has: form.locator('input[aria-label^="4 из"]') }).click()
    }
    const comment = form.locator('textarea')
    if (await comment.count()) await comment.first().fill('Стажёр сам взял задачу по отчётам и сдал её в срок.')

    const sent = form.waitForResponse((r) => r.url().endsWith('/api/ingest') && r.request().method() === 'POST', {
      timeout: WAIT,
    })
    await form.getByRole('button', { name: 'Отправить анкету' }).click()
    const res = await sent.catch(() => null)
    check(res, 'Форма не отправила POST /api/ingest. Есть пропущенные вопросы?')
    check(res.ok(), `POST /api/ingest из формы: ответ ${res.status()} ${squash(await res.text())}`)
    await waitVisible(form.getByRole('heading', { name: 'Спасибо, анкета отправлена' }), 'Экран «Спасибо»')
  })

  await step('На обзоре пришло уведомление об анкете M-04', dash, async () => {
    const text = `M-04 прислал анкету за ${month}-й месяц через форму`
    await waitVisible(dash.getByRole('status').filter({ hasText: text }), `Уведомление «Наставник ${text}»`)
  })

  await step('/form/qr без туннеля просит адрес, с адресом показывает QR-код', null, async () => {
    const qr = await desk.newPage()
    watch(qr, 'QR')
    shotPage = qr
    await qr.goto(BASE + '/form/qr')
    const code = qr.locator('svg[role="img"]')
    const local = new URL(ORIGIN).hostname
    if (local === 'localhost' || local.startsWith('127.')) {
      // Телефон в зале localhost не откроет: кода нет, есть просьба вставить адрес туннеля.
      await waitVisible(qr.getByRole('heading', { name: 'Сначала адрес туннеля' }), 'Заголовок «Сначала адрес туннеля»')
      check((await code.count()) === 0, 'На localhost QR-код рисоваться не должен')
      await qr.getByLabel('Адрес туннеля').fill('abc-def.trycloudflare.com')
      await qr.getByRole('button', { name: 'Показать' }).click()
    }
    await waitVisible(code, 'QR-код')
    const box = await code.first().boundingBox()
    check(box && box.width >= 160 && box.height >= 160, `QR-код слишком маленький: ${JSON.stringify(box)}`)
    const base = local === 'localhost' || local.startsWith('127.') ? 'https://abc-def.trycloudflare.com' : ORIGIN
    const url = `${base}/form`
    const d = await code.first().locator('path').getAttribute('d')
    check(d === qrPath(url), `QR-код ведёт не на ${url}`)
    await waitVisible(qr.locator(`a[href="${url}"]`), `Ссылка на ${url} рядом с QR-кодом`)
    await qr.getByRole('button', { name: 'Сбросить адрес' }).click()
  })

  check(browserErrors.length === 0, `Ошибки в консоли браузера:\n  ${browserErrors.join('\n  ')}`)

  current = 'Сброс базы после прогона'
  await api('POST', '/api/admin/reset')
  console.log(`\nСценарий прошёл за ${Math.round((Date.now() - started) / 1000)} с. База снова как data/sample.`)
} catch (e) {
  failed = true
  console.error(`\nНе прошёл шаг «${current}»`)
  console.error(e instanceof StepError ? e.message : e)
  if (shotPage && !shotPage.isClosed()) {
    const path = join(tmpdir(), 'sverka-e2e-fail.png')
    await shotPage.screenshot({ path, fullPage: true }).then(
      () => console.error(`Снимок экрана: ${path}`),
      () => {},
    )
  }
  if (browserErrors.length) console.error(`Ошибки в консоли браузера:\n  ${browserErrors.join('\n  ')}`)
  if (touched) console.error(`База осталась как после упавшего шага. Сбросить: curl -X POST ${BASE}/api/admin/reset`)
} finally {
  await browser.close()
}

process.exit(failed ? 1 : 0)
