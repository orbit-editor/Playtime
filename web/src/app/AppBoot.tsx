import { App } from '../App';
import { ErrorBoundary } from './ErrorBoundary';

export function AppBoot() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
