import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.fallback) {
        return this.fallback;
      }

      return (
        <div className="gf-page-center" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--error)', marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--foreground-muted)', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="gf-button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.children;
  }

  private get children() {
    return this.props.children;
  }

  private get fallback() {
    return this.props.fallback;
  }
}

export default ErrorBoundary;
