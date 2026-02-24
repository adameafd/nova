import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import novaLogo from '../../assets/nova.png';
import '../../css/public.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, API_BASE } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'tech' || user.role === 'technicien') navigate('/tech');
      else if (user.role === 'data') navigate('/data');
      else if (user.role === 'entreprise') navigate('/entreprise');
      else setError('Rôle non reconnu !');
    } catch {
      setError('Erreur réseau !');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-modal-content">
        <div className="login-modal-left">
          <img src={novaLogo} alt="NOVA" />
        </div>
        <div className="login-modal-right">
          <h2>Connexion</h2>
          {error && <div className="error-msg" role="alert">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label htmlFor="loginEmailPage">Email</label>
            <input id="loginEmailPage" type="email" placeholder="abc@gmail.com" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <label htmlFor="loginPasswordPage">Mot de passe</label>
            <input id="loginPasswordPage" type="password" placeholder="********" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
