import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'

// Куда прокси отправляет /api. По умолчанию бэкенд из make dev.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8000'

const proxy: Record<string, ProxyOptions> = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    // Поток /api/events идёт через прокси как есть, без буфера. Обрыв с любой
    // стороны прокси сам не передаёт, поэтому делаем это здесь.
    configure: (p) => {
      // Вкладку закрыли: закрываем запрос к бэкенду, иначе там копятся подписчики.
      p.on('proxyReq', (proxyReq, _req, res) => {
        res.on('close', () => proxyReq.destroy())
      })
      // Бэкенд упал или перезапустился посреди ответа: рвём ответ браузеру,
      // чтобы EventSource заметил это и переподключился.
      p.on('proxyRes', (proxyRes, _req, res) => {
        proxyRes.on('close', () => {
          if (!proxyRes.complete) res.destroy()
        })
      })
    },
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
