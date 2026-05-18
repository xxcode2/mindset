"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches React render errors
 * and displays a friendly fallback UI instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
          <div
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold" style={{ color: "#f1f5f9" }}>
            Something went wrong
          </h2>
          <p className="mb-6 max-w-md text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            The app encountered an unexpected error. This might be due to a network issue or a temporary RPC problem.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            Reload Page
          </button>
          {this.state.error && (
            <details className="mt-6 max-w-lg text-left">
              <summary
                className="cursor-pointer text-xs font-medium"
                style={{ color: "rgba(148,163,184,0.4)" }}
              >
                Error details
              </summary>
              <pre
                className="mt-2 overflow-auto rounded-xl p-4 text-xs"
                style={{
                  background: "rgba(10,10,30,0.5)",
                  border: "1px solid rgba(99,102,241,0.1)",
                  color: "rgba(248,113,113,0.8)",
                  maxHeight: 200,
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
