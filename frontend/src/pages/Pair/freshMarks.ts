// Метка «новое» на обзоре живёт в двух местах: в памяти (useLive, её снимает
// оболочка при открытии /pairs/:id) и в localStorage, чтобы пережить
// перезагрузку страницы. Здесь договорённость с обзором про localStorage
// (pages/Overview/fresh.ts, там тот же ключ и формат).
//
// Ключ FRESH_STORAGE_KEY = 'sverka.fresh'. Значение: JSON-массив
// [{ key: `${pair_id}:${role}:${month}`, at: время прихода анкеты в мс }],
// например [{"key":"P-01:intern:6","at":1795612345678}]. Обзор дописывает
// записи, когда приходит анкета; открытие карточки пары стирает все записи
// своей пары.

export const FRESH_STORAGE_KEY = 'sverka.fresh'

interface FreshEntry {
  key: string
  at: number
}

function read(): FreshEntry[] {
  try {
    const raw = localStorage.getItem(FRESH_STORAGE_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (e): e is FreshEntry => !!e && typeof e === 'object' && typeof e.key === 'string' && typeof e.at === 'number',
    )
  } catch {
    return []
  }
}

// Снять метки «новое» со всех клеток пары. Ничего не пишет, если снимать нечего.
export function clearFreshMarks(pairId: string): void {
  const list = read()
  const left = list.filter((e) => !e.key.startsWith(`${pairId}:`))
  if (left.length === list.length) return
  try {
    localStorage.setItem(FRESH_STORAGE_KEY, JSON.stringify(left))
  } catch {
    // Приватный режим или хранилище закрыто: метки останутся только в памяти.
  }
}
