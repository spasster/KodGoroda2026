// Шрифт и токены первыми: от них зависят все стили ниже (docs/design/system.md).
import '@fontsource-variable/geologica'
import './styles/tokens.css'
import './styles/base.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { ApiError } from './api/client'
import { router } from './app/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Свежесть держат события из /api/events, лишний раз не спрашиваем.
      staleTime: 10_000,
      // 404 и 422 повтором не исправить.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* prefers-reduced-motion: motion сразу ставит итоговое состояние. */}
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
