'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-400 bg-red-900/20 rounded-lg">
          <p className="text-sm">组件加载失败: {this.props.name}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
