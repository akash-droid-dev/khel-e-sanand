/**
 * Error boundary.
 *
 * §1 requires a clear error state on every surface. A render failure is the one case
 * a screen cannot report for itself, so this catches it and shows the same shape of
 * message — including a reference the user can quote — rather than a blank page.
 *
 * It deliberately shows no stack trace: §14 forbids leaking internals, and a
 * volunteer at a sports ground cannot act on one.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; reference: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reference: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, reference: crypto.randomUUID().slice(0, 8) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Logged locally only. No third party receives event data (§11, DPDP §9).
    console.error('Render failure', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="state state--error" role="alert">
        <p><strong>This screen could not be displayed.</strong></p>
        <p>
          Your saved drafts on this device are untouched. Reload the page; if it happens
          again, quote reference <code>{this.state.reference}</code> to the Event Director.
        </p>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
