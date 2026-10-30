import { Component, type ReactNode } from "react";

/** Shows `fallback` instead of crashing the whole app when its children throw while drawing. */
export class ErrorBoundary extends Component<{ fallback: (reset: () => void) => ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Tree failed to draw", error);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
