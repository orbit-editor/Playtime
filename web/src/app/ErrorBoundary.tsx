import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * 渲染层最后一道保险：即使某个页面出错，也只显示一句孩子看得懂的话，
 * 不会把教室大屏留在一片白屏上。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[playtime] 页面出错了', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="crash-screen" role="alert">
        <span className="crash-screen__icon" aria-hidden="true">
          <CircleAlert size={64} strokeWidth={1.7} />
        </span>
        <h1>哎呀，这里卡了一下</h1>
        <p>点一下下面的大按钮，就能回到首页接着玩。</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={this.handleReload}>
          回到首页
        </button>
      </div>
    );
  }
}
