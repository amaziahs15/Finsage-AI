import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">
          <p className="font-medium">Something went wrong loading this form — please refresh or contact support.</p>
          {this.state.error?.message && (
            <p className="mt-1 text-xs opacity-80">{this.state.error.message}</p>
          )}
          <button
            onClick={this.reset}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
