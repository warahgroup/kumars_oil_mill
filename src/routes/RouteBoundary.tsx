import type { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function RouteBoundary({ title, children }: { title: string; children: ReactNode }) {
  return <ErrorBoundary title={title}>{children}</ErrorBoundary>
}
