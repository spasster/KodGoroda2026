import { createBrowserRouter } from 'react-router-dom'

import { FormPage } from '../pages/Form'
import { OverviewPage } from '../pages/Overview'
import { PairPage } from '../pages/Pair'
import { SignalsPage } from '../pages/Signals'
import { AppShell } from './AppShell'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'pairs/:id', element: <PairPage /> },
      { path: 'signals', element: <SignalsPage /> },
      { path: '*', element: <p>Такой страницы нет</p> },
    ],
  },
  // Форма без оболочки дашборда: её открывают стажёр и наставник.
  { path: '/form', element: <FormPage /> },
])
