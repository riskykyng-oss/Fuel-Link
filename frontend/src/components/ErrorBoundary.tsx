import { Component, type ReactNode } from "react";
import { Icon } from "./brand";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: 24,
            textAlign: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "var(--danger, #e74c3c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="siren" size={28} />
          </span>
          <h1 style={{ margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "var(--muted, #888)", maxWidth: 400, margin: 0 }}>
            The app hit an unexpected error. Your data is safe — try reloading.
          </p>
          <pre
            style={{
              fontSize: 12,
              color: "var(--muted, #888)",
              background: "var(--surface, #1a1a1a)",
              padding: 12,
              borderRadius: 8,
              maxWidth: "100%",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              background: "var(--accent-fill, #c8ff00)",
              color: "var(--accent-ink, #000)",
              border: "none",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              background: "transparent",
              color: "var(--muted, #888)",
              border: "1px solid var(--border, #333)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
