import {Component, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Shows the error on screen instead of leaving a blank page if rendering crashes.
class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Pustaha Simalungun crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 24, fontFamily: 'sans-serif', maxWidth: 640, margin: '40px auto'}}>
          <h1 style={{fontSize: 20, marginBottom: 12}}>Terjadi kesalahan saat memuat aplikasi</h1>
          <pre style={{whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 12, borderRadius: 8}}>
            {this.state.error.message}
          </pre>
          <button
            style={{marginTop: 12, padding: '8px 16px', cursor: 'pointer'}}
            onClick={() => {
              try {
                localStorage.clear();
              } catch {
                // ignore
              }
              location.reload();
            }}
          >
            Reset data lokal &amp; muat ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
