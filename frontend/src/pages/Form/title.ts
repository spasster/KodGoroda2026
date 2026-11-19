import { useEffect } from 'react'

// Заголовок вкладки, пока страница открыта.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}
