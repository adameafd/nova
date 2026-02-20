import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, resolvePhotoUrl } from '../../context/AuthContext';
import '../../css/accueil.css';
import '../../css/notifications.css';

const TYPE_CONFIG = {
  COMPTE_RENDU: { icon: 'fa-file-lines', color: '#1abc9c', label: 'Compte rendu' },
  STOCK:        { icon: 'fa-boxes-stacked', color: '#f39c12', label: 'Stock' },
  ALERTE:       { icon: 'fa-triangle-exclamation', color: '#e74c3c', label: 'Alerte' },
  INTERVENTION: { icon: 'fa-wrench', color: '#9b59b6', label: 'Intervention' },
  INFO:         { icon: 'fa-circle-info', color: '#3498db', label: 'Info' },
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "A l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function DataAccueil() {
  const { user, API_BASE } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const currentUserId = Number(user?.id);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/latest?userId=${currentUserId}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [API_BASE, currentUserId]);

  useEffect(() => {
    fetch(`${API_BASE}/utilisateurs`)
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
    loadNotifications();
  }, [API_BASE, loadNotifications]);

  useEffect(() => {
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  return (
    <>
      <section className="welcome-section">
        <h1>Bonjour <span className="username">{user?.nom || 'Utilisateur'}</span></h1>
        <p>Bienvenue dans votre espace Data NOVA.</p>
      </section>

      <section className="dashboard-overview">
        <div className="left-panel">
          <div className="notif-widget-header">
            <h2><i className="fa-solid fa-bell"></i> Dernières notifications</h2>
          </div>
          {notifications.length === 0 ? (
            <div className="notif-widget-empty">Aucune notification pour le moment.</div>
          ) : (
            <ul className="notif-widget-list">
              {notifications.map(n => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO;
                return (
                  <li key={n.id} className={`notif-widget-item${!n.is_read ? ' unread' : ''}`}>
                    <div className="notif-widget-icon" style={{ background: config.color }}>
                      <i className={`fa-solid ${config.icon}`}></i>
                    </div>
                    <div className="notif-widget-body">
                      <div className="notif-widget-top">
                        <span className="notif-type-badge" style={{ color: config.color }}>{config.label}</span>
                        <span className="notif-widget-time">{timeAgo(n.created_at)}</span>
                      </div>
                      <div className="notif-widget-message">{n.message}</div>
                    </div>
                    {n.link && (
                      <button className="notif-voir-btn" onClick={() => navigate(`/data/${n.link}`)}>
                        Voir
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="right-panel">
          <h2><i className="fa-solid fa-users"></i> Activité des utilisateurs</h2>
          <div className="user-status connected">
            <h3><i className="fa-solid fa-circle text-green"></i> En ligne</h3>
            <ul>
              {users.slice(0, 2).map((u, i) => (
                <li key={i}><img src={resolvePhotoUrl(u.photo_url)} alt="" />{u.nom}</li>
              ))}
            </ul>
          </div>
          <div className="user-status offline">
            <h3><i className="fa-solid fa-circle text-red"></i> Hors ligne</h3>
            <ul>
              {users.slice(2, 4).map((u, i) => (
                <li key={i}><img src={resolvePhotoUrl(u.photo_url)} alt="" />{u.nom}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
