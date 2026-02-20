import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: 40,
          textAlign: 'center', color: 'var(--text, #333)',
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 48, color: '#e74c3c', marginBottom: 16 }}></i>
          <h2 style={{ margin: '0 0 8px' }}>Une erreur est survenue</h2>
          <p style={{ color: 'var(--muted, #888)', marginBottom: 24 }}>
            {this.state.error?.message || 'Erreur inattendue'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'var(--blue, #2563eb)', color: '#fff',
              cursor: 'pointer', fontSize: 14,
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
