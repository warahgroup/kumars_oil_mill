import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

type Props = {
  children: ReactNode
  title?: string
}

type State = { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route error boundary:', error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-700">
            {this.props.title ?? 'Something went wrong'}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{this.state.message}</p>
          <Button className="mt-4" variant="secondary" onClick={this.handleRetry}>
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
