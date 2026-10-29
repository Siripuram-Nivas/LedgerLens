import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('LedgerLens UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-danger-100 bg-danger-50 text-danger-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-base font-semibold text-ink">This view stopped rendering</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {this.state.message || 'An unexpected interface error occurred.'} No financial data was
            changed by this error.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Reload LedgerLens
          </Button>
        </div>
      </div>
    );
  }
}
