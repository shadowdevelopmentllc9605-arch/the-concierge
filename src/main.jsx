import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Keep errors visible during the isolated Phase One shopper test instead of
// leaving an unresponsive white screen. Does not change checkout permissions.
class ShopperPreviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Concierge preview render failed', error);
    window.__conciergePreviewFailure?.('RENDER_ERROR', error?.message || 'The page could not render');
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert" style={{ padding: 32, color: '#172033', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Shopper preview couldn't open</h1>
          <p>The page encountered a rendering error. This test preview shows the error name and message so we can fix it.</p>
          <pre data-testid="shopper-preview-error" style={{ maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
            {String(this.state.error?.name || 'Error') + ': ' + String(this.state.error?.message || 'Unknown rendering failure').slice(0, 400)}
          </pre>
          <button type="button" style={{ marginTop: 12, padding: '10px 16px', background: '#6d28d9', color: '#fff', border: 0, borderRadius: 8 }} onClick={() => window.location.reload()}>Try again</button>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ShopperPreviewErrorBoundary>
    <App />
  </ShopperPreviewErrorBoundary>
)
