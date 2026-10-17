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
          <p>Something interrupted this test page. Please share a screenshot of the displayed error.</p>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
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
