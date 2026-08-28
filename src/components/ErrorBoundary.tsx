import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[Lumen] UI 崩溃:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          color: '#e0e0e0',
          background: '#1a1a2e',
          height: '100vh',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h2 style={{ color: '#ff6b6b' }}>💥 界面出了点问题</h2>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              background: '#6c5ce7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
