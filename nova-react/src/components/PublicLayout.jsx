import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import novaLogo from '../assets/nova.png';
import '../css/public.css';

export default function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, API_BASE } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && loginOpen) setLoginOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [loginOpen]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mot_de_passe: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Connexion impossible'); setLoading(false); return; }
      const user = { ...data.user, role: (data.user.role || '').toLowerCase() };
      login(user);
      setLoginOpen(false);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'tech' || user.role === 'technicien') navigate('/tech');
      else if (user.role === 'data') navigate('/data');
      else { setError('Rôle non reconnu !'); setLoading(false); }
    } catch {
      setError('Erreur réseau !');
      setLoading(false);
    }
  };

  return (
    <div className="public-page">
      <header className="public-header">
        <nav className={`public-nav${scrolled ? ' scrolled' : ''}`} aria-label="Navigation principale">
          <div className="logo">
            <Link to="/"><img src={novaLogo} alt="NOVA - Accueil" /></Link>
          </div>

          <button
            className="nav-toggle"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>

          <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
            <li><Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Accueil</Link></li>
            <li><Link to="/about" className={location.pathname === '/about' ? 'active' : ''} onClick={() => setMenuOpen(false)}>À propos</Link></li>
            <li><Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Nous contacter</Link></li>
          </ul>

          <button className="btn-login-open" aria-label="Se connecter" onClick={() => setLoginOpen(true)}>
            <i className="fa-solid fa-circle-user"></i>
          </button>
        </nav>
      </header>

      <Outlet />

      <footer className="public-footer">
        &copy; {new Date().getFullYear()} NOVA Smart City &mdash; Tous droits réservés.
      </footer>

      {loginOpen && (
        <div className="login-modal-overlay" role="dialog" aria-modal="true" aria-label="Connexion" onClick={(e) => { if (e.target === e.currentTarget) setLoginOpen(false); }}>
          <div className="login-modal-content">
            <div className="login-modal-left" aria-hidden="true">
              <img src={novaLogo} alt="" />
            </div>
            <div className="login-modal-right">
              <button className="login-close" aria-label="Fermer la fenêtre de connexion" onClick={() => setLoginOpen(false)}>&times;</button>
              <h2>Connexion</h2>
              {error && <div className="error-msg" role="alert">{error}</div>}
              <form onSubmit={handleLogin}>
                <label htmlFor="loginEmail">Email</label>
                <input id="loginEmail" type="email" placeholder="abc@gmail.com" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                <label htmlFor="loginPassword">Mot de passe</label>
                <input id="loginPassword" type="password" placeholder="********" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <a href="#" className="forgot" onClick={e => e.preventDefault()}>Mot de passe oublié ?</a>
                <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
