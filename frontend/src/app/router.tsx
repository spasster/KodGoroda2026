import { createBrowserRouter } from 'react-router-dom'

import { EmptyState } from '../components/EmptyState'
import { LinkButton } from '../components/Button'
import { FormPage } from '../pages/Form'
import { FormQrPage } from '../pages/Form/Qr'
import { OverviewPage } from '../pages/Overview'
import { PairPage } from '../pages/Pair'
import { SignalsPage } from '../pages/Signals'
import { LiveProvider } from '../live/LiveProvider'
import { AppShell } from './AppShell'

function NotFound() {
  return (
    <div className="wrap">
      <EmptyState
        title="Такой страницы нет"
        text="Проверьте адрес или вернитесь к обзору."
        actions={<LinkButton to="/">К обзору</LinkButton>}
      />
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    // /api/events держит только дашборд. Форма и QR живут без него: у браузера
    // шесть соединений на хост, и лишние потоки встают в очередь.
    element: (
      <LiveProvider>
        <AppShell />
      </LiveProvider>
    ),
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'pairs/:id', element: <PairPage /> },
      { path: 'signals', element: <SignalsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  // Форма и QR без оболочки дашборда: их открывают стажёр, наставник и жюри с телефона.
  { path: '/form', element: <FormPage /> },
  { path: '/form/qr', element: <FormQrPage /> },
])
