import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, resolvePhotoUrl } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getSocket } from '../../socket';
import '../../css/accueil.css';
import '../../css/notifications.css';

// Mapping notif.link → route admin complète
const LINK_MAP = {
  messages:           '/admin/messagerie',
  messagerie:         '/admin/messagerie',
  stock:              '/admin/stock',
  'compte-rendu':     '/admin/compte-rendu',
  alertes:            '/admin/alerts',
  alerts:             '/admin/alerts',
  interventions:      '/admin/interventions',
  dashboard:          '/admin/dashboard',
  'alertes-internes': '/admin/alertes-internes',
};

const TYPE_CONFIG = {
  COMPTE_RENDU:   { icon: 'fa-file-lines',          color: '#1abc9c', label: 'Compte rendu'  },
  STOCK:          { icon: 'fa-boxes-stacked',        color: '#f39c12', label: 'Stock'          },
  ALERTE:         { icon: 'fa-triangle-exclamation', color: '#e74c3c', label: 'Alerte'         },
  ALERTE_INTERNE: { icon: 'fa-circle-exclamation',   color: '#e67e22', label: 'Alerte interne' },
  INTERVENTION:   { icon: 'fa-wrench',               color: '#9b59b6', label: 'Intervention'   },
  INFO:           { icon: 'fa-circle-info',          color: '#3498db', label: 'Info'           },
};

function timeAgo(dateStr) {
  const now  = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)     return "A l'instant";
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function AdminAccueil() {
  const { user, API_BASE } = useAuth();
  const navigate = useNavigate();
  const { notifications, setNotifications, unreadCount, markAllRead } = useNotifications();
  const [users, setUsers] = useState([]);

  // Charger la liste des utilisateurs + état Socket pour statuts en ligne
  useEffect(() => {
    fetch(`${API_BASE}/utilisateurs`)
      .then(res => res.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));

    const socket = getSocket();
    console.log('[Accueil-admin] monté | socket.connected =', socket.connected, ' | socketId =', socket.id ?? 'n/a');

    const onStatusUpdate = ({ userId, statut }) => {
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, statut_activite: statut } : u
      ));
    };

    socket.on('users:status_update', onStatusUpdate);
    return () => socket.off('users:status_update', onStatusUpdate);
  }, [API_BASE]);

  const handleVoir = useCallback(async (notif) => {
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    try {
      await fetch(`${API_BASE}/notifications/${notif.id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[Accueil-admin] Erreur suppression notif:', err.message);
    }
    navigate(LINK_MAP[notif.link] ?? '/admin');
  }, [API_BASE, navigate, setNotifications]);

  const online  = users.filter(u => u.statut_activite === 'en_ligne');
  const offline = users.filter(u => u.statut_activite !== 'en_ligne');

  return (
    <>
      <section className="welcome-section">
        <h1>Bonjour M. <span className="username">{user?.nom || 'Utilisateur'}</span></h1>
        <p>Bienvenue dans votre espace d'administration NOVA.</p>
      </section>

      <section className="dashboard-overview">
        <div className="left-panel">
          <div className="notif-widget-header">
            <h2>
              <i className="fa-solid fa-bell"></i> Dernières notifications
              {unreadCount > 0 && <span className="notif-unread-count">{unreadCount}</span>}
            </h2>
            {unreadCount > 0 && (
              <button className="notif-mark-all-btn" onClick={markAllRead}>
                Tout lire
              </button>
            )}
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
                      {n.title && <div className="notif-widget-title">{n.title}</div>}
                      <div className="notif-widget-message">{n.message}</div>
                    </div>
                    {n.link && LINK_MAP[n.link] && (
                      <button
                        className="notif-widget-voir"
                        onClick={() => handleVoir(n)}
                        title="Voir"
                      >
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
            <h3>
              <i className="fa-solid fa-circle text-green"></i> En ligne
              {online.length > 0 && <span className="status-count">{online.length}</span>}
            </h3>
            <ul>
              {online.length === 0
                ? <li className="status-empty">Aucun utilisateur en ligne</li>
                : online.map(u => (
                  <li key={u.id}>
                    <span className="status-dot online"></span>
                    <img src={resolvePhotoUrl(u.photo_url)} alt="" />
                    <span>{u.nom}</span>
                  </li>
                ))
              }
            </ul>
          </div>

          <div className="user-status offline">
            <h3>
              <i className="fa-solid fa-circle text-red"></i> Hors ligne
              {offline.length > 0 && <span className="status-count">{offline.length}</span>}
            </h3>
            <ul>
              {offline.length === 0
                ? <li className="status-empty">Aucun</li>
                : offline.map(u => (
                  <li key={u.id}>
                    <span className="status-dot offline"></span>
                    <img src={resolvePhotoUrl(u.photo_url)} alt="" />
                    <span>{u.nom}</span>
                  </li>
                ))
              }
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
