import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { ApiError } from './api/client'
import { router } from './app/router'
import { LiveProvider } from './live/LiveProvider'

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
      <LiveProvider>
        <RouterProvider router={router} />
      </LiveProvider>
    </QueryClientProvider>
  </StrictMode>,
)
