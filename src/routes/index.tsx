import { Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PageState } from '@/components/common/PageState'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RouteErrorElement } from '@/components/layout/RouteErrorBoundary'
import { RouteBoundary } from '@/routes/RouteBoundary'
import * as Pages from '@/routes/lazyPages'

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageState status="loading" />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/home" replace /> },
          {
            path: '/home',
            errorElement: <RouteErrorElement title="Home error" />,
            element: (
              <Lazy>
                <RouteBoundary title="Home error">
                  <Pages.HomePage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/buy',
            errorElement: <RouteErrorElement title="Buy error" />,
            element: (
              <Lazy>
                <RouteBoundary title="Buy error">
                  <Pages.BuyPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/buy/new',
            element: (
              <Lazy>
                <RouteBoundary title="Buy error">
                  <Pages.BuyNewPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/produce',
            element: (
              <Lazy>
                <RouteBoundary title="Produce error">
                  <Pages.ProducePage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/produce/new',
            element: (
              <Lazy>
                <RouteBoundary title="Produce error">
                  <Pages.ProduceNewPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/crushing',
            errorElement: <RouteErrorElement title="Crushing error" />,
            element: (
              <Lazy>
                <RouteBoundary title="Crushing error">
                  <Pages.CrushingPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/crushing/new',
            element: (
              <Lazy>
                <RouteBoundary title="Crushing error">
                  <Pages.CrushingNewPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/crushing/:id',
            element: (
              <Lazy>
                <RouteBoundary title="Crushing error">
                  <Pages.CrushingDetailPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/bottle',
            element: (
              <Lazy>
                <RouteBoundary title="Bottle error">
                  <Pages.BottlePage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/bottle/new',
            element: (
              <Lazy>
                <RouteBoundary title="Bottle error">
                  <Pages.BottleNewPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/sell',
            element: (
              <Lazy>
                <RouteBoundary title="Sell error">
                  <Pages.SellPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/sell/new',
            element: (
              <Lazy>
                <RouteBoundary title="Sell error">
                  <Pages.SellNewPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/expense',
            element: (
              <Lazy>
                <RouteBoundary title="Expense error">
                  <Pages.ExpensePage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/expense/new',
            element: (
              <Lazy>
                <RouteBoundary title="Expense error">
                  <Pages.ExpenseNewPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/stock',
            element: (
              <Lazy>
                <RouteBoundary title="Stock error">
                  <Pages.StockPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/bills',
            element: (
              <Lazy>
                <RouteBoundary title="Bills error">
                  <Pages.BillsPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/bills/:saleId',
            element: (
              <Lazy>
                <RouteBoundary title="Bill error">
                  <Pages.BillDetailPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/customers',
            element: (
              <Lazy>
                <RouteBoundary title="Customers error">
                  <Pages.CustomersPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/more',
            element: (
              <Lazy>
                <RouteBoundary title="More error">
                  <Pages.MorePage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/reports',
            errorElement: <RouteErrorElement title="Reports error" />,
            element: (
              <Lazy>
                <RouteBoundary title="Reports error">
                  <Pages.ReportsPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
          {
            path: '/settings',
            errorElement: <RouteErrorElement title="Settings error" />,
            element: (
              <Lazy>
                <RouteBoundary title="Settings error">
                  <Pages.SettingsPage />
                </RouteBoundary>
              </Lazy>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/home" replace /> },
])
