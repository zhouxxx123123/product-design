import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback; defaults to the built-in error card */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to console in dev; replace with your error-reporting SDK in prod.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">页面出现了错误</h2>
          <p className="text-sm text-slate-500 max-w-sm">
            {this.state.error?.message ?? '未知错误，请刷新页面或联系管理员。'}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          重新加载
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
