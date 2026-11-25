// Сквозной сценарий демо в настоящем браузере: pnpm e2e.
//
// По умолчанию проверяет Docker (make up) на http://localhost:8080.
// Другой адрес: BASE_URL=http://localhost:5173 pnpm e2e
//
// В начале сбрасывает базу к data/sample, потому что сценарий начинается с пары
// Ильи Морозова (P-01) в статусе «Всё ровно». Если всё прошло, сбрасывает ещё
// раз, чтобы демо начиналось с чистых данных. Если шаг упал, база остаётся как
// есть, а снимок экрана лежит во временной папке, путь печатается.

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

// Карточка стажёра на обзоре: ссылка с data-status (risk, watch, ok).
const pairRow = (page, intern) => page.locator('main a[data-status]').filter({ hasText: intern })
const cardStatus = (page, intern) => pairRow(page, intern).first().getAttribute('data-status')

const liveDot = (page) => page.locator('header').getByText('онлайн', { exact: true })

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
  // Пары и люди по именам из справочника survey/people.json.
  let names = {}

  await step('Бэкенд отвечает, база сброшена к data/sample', null, async () => {
    const health = await api('GET', '/api/health')
    check(health?.ok, `/api/health: ${JSON.stringify(health)}`)
    await api('POST', '/api/admin/reset')
    touched = true
    const overview = await api('GET', '/api/overview')
    const pair = (id) => overview.pairs.find((p) => p.pair_id === id)
    check(pair('P-01'), 'В /api/overview нет пары P-01. Это не data/sample?')
    check(pair('P-01').status === 'ok', `P-01 после сброса в статусе ${pair('P-01').status}, ждали ok`)
    names = {
      ilya: pair('P-01').intern_name,
      timur: pair('P-03').intern_name,
      olga: pair('P-04').mentor_name,
    }
    check(names.ilya && names.timur && names.olga, `В /api/overview нет имён: ${JSON.stringify(names)}`)
  })

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' })
  const dash = await desk.newPage()
  watch(dash, 'дашборд')

  await step('Обзор открылся, у Ильи Морозова «Всё ровно», связь онлайн', dash, async () => {
    await dash.goto(BASE + '/')
    await waitVisible(pairRow(dash, names.ilya), `Карточка «${names.ilya}» на обзоре`)
    check((await cardStatus(dash, names.ilya)) === 'ok', `Карточка «${names.ilya}» не в группе «Всё ровно»`)
    await waitVisible(liveDot(dash), 'Точка связи «онлайн» в шапке')
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

  await step('Без перезагрузки: уведомление и смена статуса пары Ильи Морозова', dash, async () => {
    const who = `${names.ilya}, стажёр, 6-й месяц`
    const toast = dash.getByRole('status').filter({ hasText: who })
    await waitVisible(toast, `Уведомление «Новая анкета: ${who}»`)
    await waitText(toast, 'Новая анкета', 'Уведомление о новой анкете')
    await waitText(toast, 'Всё ровно', 'Уведомление: статус до анкеты')
    await waitText(toast, 'Пора поговорить', 'Уведомление: статус после анкеты')
    // Карточка ушла из «Всё ровно» в «Пора поговорить» и получила метку «новая анкета».
    const until = Date.now() + WAIT
    let status = ''
    while (Date.now() < until) {
      status = (await cardStatus(dash, names.ilya).catch(() => '')) ?? ''
      if (status === 'risk') break
      await sleep(150)
    }
    check(status === 'risk', `Карточка «${names.ilya}» осталась в статусе «${status}»`)
    await waitText(pairRow(dash, names.ilya), 'новая анкета', `Метка «новая анкета» на карточке «${names.ilya}»`)
    const overview = await api('GET', '/api/overview')
    const p01 = overview.pairs.find((p) => p.pair_id === 'P-01')
    check(p01.status === 'risk', `P-01 после анкеты в статусе ${p01.status}, ждали risk`)
    const same = await dash.evaluate(() => window.__e2eNoReload === true)
    check(same, 'Страница обзора перезагрузилась, а данные должны были прийти через /api/events')
  })

  await step('Карточка Тимура Галиева: «Проблема подтвердилась» сохраняется после перезагрузки', dash, async () => {
    await dash.goto(BASE + '/')
    await pairRow(dash, names.timur).first().click()
    await waitVisible(dash.getByRole('heading', { level: 1, name: names.timur }), `Заголовок «${names.timur}» на карточке пары`)
    const confirm = (scope) => scope.getByRole('button', { name: 'Проблема подтвердилась', exact: true })
    const open = dash.locator('article').filter({ has: confirm(dash) })
    await waitVisible(open, 'Открытый сигнал с кнопкой «Проблема подтвердилась»')
    // В заголовке точка важности со скрытым словом, текст сигнала в последнем span.
    const title = (await open.first().locator('h3 > span').last().innerText()).split(' · ')[0].replace(/\s+/g, ' ').trim()

    // Карточка может нести повторы за несколько месяцев: отметка уходит на каждый.
    const keys = []
    const onRequest = (r) => {
      const m = decodeURIComponent(r.url()).match(/\/api\/signals\/(.+)\/review$/)
      if (m && r.method() === 'POST') keys.push(m[1])
    }
    dash.on('request', onRequest)
    const saved = dash.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/review'), { timeout: WAIT })
    await confirm(open.first()).click()
    const res = await saved.catch(() => null)
    check(res, `Запрос отметки сигнала «${title}» не ушёл`)
    check(res.ok(), `Отметка «${title}»: ответ ${res.status()}`)
    await sleep(500)
    dash.off('request', onRequest)
    check(keys.length > 0, `Не поймали ключ сигнала «${title}»`)

    await dash.reload()
    const done = dash.getByRole('button', { name: /^Разобранные: \d+/ })
    await waitVisible(done, 'Строка «Разобранные: N»')
    await done.click()
    const item = dash.locator('#pair-done li').filter({ hasText: title })
    await waitVisible(item, `«${title}» в разобранных после перезагрузки`)
    await waitText(item, 'подтвердилось', `«${title}» в разобранных`)
    await waitVisible(item.getByRole('button', { name: 'Вернуть' }), `Кнопка «Вернуть» у «${title}»`)
    const pair = await api('GET', '/api/pairs/P-03')
    for (const key of keys) {
      const signal = pair.signals.find((x) => x.key === key)
      check(signal?.review.status === 'confirmed', `В /api/pairs/P-03 у ${key} отметка ${signal?.review.status}`)
    }
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
    await waitVisible(pairRow(dash, names.ilya), 'Таблица обзора')
    await waitVisible(liveDot(dash), 'Точка связи «онлайн» в шапке')

    const people = await api('GET', '/api/people')
    month = people.mentors.find((p) => p.id === 'M-04')?.next_month
    check(month, `У наставника M-04 нет свободного месяца: ${JSON.stringify(people.mentors)}`)

    await form.goto(BASE + '/form')
    const mentorBtn = form.getByRole('button', { name: 'Наставник', exact: true })
    await waitVisible(mentorBtn, 'Кнопка «Наставник»')
    await mentorBtn.click()
    const person = form.getByRole('button', { name: new RegExp(`^${names.olga}`) })
    await waitVisible(person, `Кнопка «${names.olga}» в списке наставников`)
    await person.click()
    await waitText(form.locator('h1'), names.olga, 'Имя наставника на втором шаге')
    const chosen = await form.getByLabel('Месяц', { exact: true }).inputValue()
    check(Number(chosen) === month, `Месяц в форме ${chosen}, ждали ${month}`)

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
    await form.getByRole('button', { name: 'Отправить', exact: true }).click()
    const res = await sent.catch(() => null)
    check(res, 'Форма не отправила POST /api/ingest. Есть пропущенные вопросы?')
    check(res.ok(), `POST /api/ingest из формы: ответ ${res.status()} ${squash(await res.text())}`)
    await waitVisible(form.getByRole('heading', { name: 'Спасибо, анкета отправлена' }), 'Экран «Спасибо»')
    await waitVisible(form.getByRole('button', { name: 'Заполнить ещё одну' }), 'Кнопка «Заполнить ещё одну»')
  })

  await step('На обзоре пришло уведомление об анкете M-04', dash, async () => {
    const who = `${names.olga}, наставник, ${month}-й месяц`
    await waitVisible(dash.getByRole('status').filter({ hasText: who }), `Уведомление «Новая анкета: ${who}»`)
  })

  await step('/form/qr без туннеля просит адрес, с адресом показывает QR-код', null, async () => {
    const qr = await desk.newPage()
    watch(qr, 'QR')
    shotPage = qr
    await qr.goto(BASE + '/form/qr')
    await waitVisible(qr.getByRole('heading', { name: 'Анкета стажировки МГТС' }), 'Заголовок «Анкета стажировки МГТС»')
    const code = qr.locator('svg[role="img"]')
    const local = new URL(ORIGIN).hostname
    const isLocal = local === 'localhost' || local.startsWith('127.')
    if (isLocal) {
      // Телефон в зале localhost не откроет: кода нет, есть просьба вставить адрес туннеля.
      await waitVisible(qr.getByText('Вставьте адрес туннеля', { exact: true }), 'Подсказка «Вставьте адрес туннеля»')
      check((await code.count()) === 0, 'На localhost QR-код рисоваться не должен')
      await qr.getByLabel('Адрес туннеля').fill('abc-def.trycloudflare.com')
      await qr.getByRole('button', { name: 'Показать' }).click()
    }
    await waitVisible(code, 'QR-код')
    const box = await code.first().boundingBox()
    check(box && box.width >= 160 && box.height >= 160, `QR-код слишком маленький: ${JSON.stringify(box)}`)
    const url = `${isLocal ? 'https://abc-def.trycloudflare.com' : ORIGIN}/form`
    const d = await code.first().locator('path').getAttribute('d')
    check(d === qrPath(url), `QR-код ведёт не на ${url}`)
    await waitVisible(qr.locator(`a[href="${url}"]`), `Ссылка на ${url} рядом с QR-кодом`)
    if (isLocal) {
      // Пустое поле возвращает адрес этого компьютера, чтобы прогон не оставлял следов.
      await qr.getByRole('button', { name: 'Изменить адрес' }).click()
      await qr.getByLabel('Адрес туннеля').fill('')
      await qr.getByRole('button', { name: 'Показать' }).click()
      await waitVisible(qr.getByText('Вставьте адрес туннеля', { exact: true }), 'Подсказка после сброса адреса')
    }
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
