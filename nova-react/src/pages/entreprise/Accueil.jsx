import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStatutLabel } from '../../utils/helpers';
import '../../css/accueil.css';
import '../../css/alerts.css';

export default function EntrepriseAccueil() {
  const { user, API_BASE } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_BASE}/alertes/by-creator/${user.id}`)
      .then(r => r.json())
      .then(d => setAlerts(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(() => setAlerts([]));
  }, [API_BASE, user?.id]);

  return (
    <>
      <section className="welcome-section">
        <h1>Bonjour <span className="username">{user?.nom || 'Entreprise'}</span></h1>
        <p>Bienvenue dans votre espace entreprise NOVA.</p>
      </section>

      <section className="dashboard-overview">
        <div className="left-panel" style={{ gridColumn: '1 / -1' }}>
          <h2><i className="fa-solid fa-triangle-exclamation"></i> Mes dernières alertes</h2>
          {alerts.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              Aucune alerte soumise pour le moment.{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigate('/entreprise/alerts')}
              >
                Soumettre une alerte
              </button>
            </p>
          ) : (
            <table className="alert-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td>{a.type_alerte || '-'}</td>
                    <td className="message-cell">{a.description || '-'}</td>
                    <td>
                      <span className={`badge statut-${a.statut || ''}`}>
                        {getStatutLabel(a.statut)}
                      </span>
                    </td>
                    <td className="date-cell">
                      {a.date_creation
                        ? new Date(a.date_creation).toLocaleDateString('fr-FR')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {alerts.length > 0 && (
            <button
              className="btn-cancel"
              style={{ marginTop: 12 }}
              onClick={() => navigate('/entreprise/alerts')}
            >
              Voir toutes mes alertes
            </button>
          )}
        </div>
      </section>
    </>
  );
}
