import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Prevent a blank screen if the app fails to render. The error reference is
// safe to show publicly; detailed diagnostics stay in console logs.
class ShopperErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Concierge render failed', error);
    window.__conciergePreviewFailure?.('RENDER_ERROR', error?.message || 'The page could not render');
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert" style={{ padding: 32, color: '#172033', fontFamily: 'system-ui, sans-serif' }}>
          <h1>The Concierge couldn't open</h1>
          <p>A page error occurred. Please try reloading. If the issue continues, contact support.</p>
          <pre data-testid="shopper-preview-error" style={{ maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
            RENDER_ERROR
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
