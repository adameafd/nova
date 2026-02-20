import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import '../css/notifications.css';

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

const CATEGORY_ICONS = {
  message: 'fa-envelope',
  alerte: 'fa-triangle-exclamation',
  stock: 'fa-boxes-stacked',
  intervention: 'fa-wrench',
  'compte-rendu': 'fa-file-lines',
  system: 'fa-gear',
  info: 'fa-circle-info',
};

const CATEGORY_COLORS = {
  message: '#3498db',
  alerte: '#e74c3c',
  stock: '#f39c12',
  intervention: '#9b59b6',
  'compte-rendu': '#1abc9c',
  system: '#6b7b8c',
  info: '#27ae60',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'unread', label: 'Non lues' },
  { value: 'message', label: 'Messages' },
  { value: 'alerte', label: 'Alertes' },
  { value: 'stock', label: 'Stock' },
  { value: 'intervention', label: 'Interventions' },
  { value: 'compte-rendu', label: 'Comptes rendus' },
];

export default function NotificationsDropdown() {
  const { user, API_BASE } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const dropdownRef = useRef(null);
  const currentUserId = Number(user?.id);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${API_BASE}/notifications?userId=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [API_BASE, currentUserId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Polling every 30s
  useEffect(() => {
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Socket real-time
  useEffect(() => {
    if (!currentUserId) return;
    const socket = getSocket();
    const handleNew = (notif) => {
      if (Number(notif.user_id) === currentUserId) {
        setNotifications(prev => [notif, ...prev]);
      }
    };
    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [currentUserId]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    try {
      await fetch(`${API_BASE}/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    try {
      await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
    } catch { /* silent */ }
  };

  const deleteNotif = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE' });
    } catch { /* silent */ }
  };

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markRead(notif.id);
    if (notif.link) window.location.href = notif.link;
  };

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.category === filter;
  });

  return (
    <div className="notif-dropdown-wrapper" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <i className="fa-solid fa-bell"></i>
        {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={markAllRead}>
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="notif-filters">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`notif-filter-btn${filter === opt.value ? ' active' : ''}`}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="notif-dropdown-list">
            {filtered.length === 0 ? (
              <div className="notif-empty">Aucune notification</div>
            ) : filtered.map(n => (
              <div
                key={n.id}
                className={`notif-item${!n.is_read ? ' unread' : ''}`}
                onClick={() => handleNotifClick(n)}
              >
                <div
                  className="notif-item-icon"
                  style={{ background: CATEGORY_COLORS[n.category] || CATEGORY_COLORS.info }}
                >
                  <i className={`fa-solid ${CATEGORY_ICONS[n.category] || CATEGORY_ICONS.info}`}></i>
                </div>
                <div className="notif-item-content">
                  <div className="notif-item-title">{n.title}</div>
                  {n.description && <div className="notif-item-desc">{n.description}</div>}
                  <div className="notif-item-time">{timeAgo(n.created_at)}</div>
                </div>
                <div className="notif-item-actions" onClick={e => e.stopPropagation()}>
                  {!n.is_read && (
                    <button className="notif-action-btn" title="Marquer comme lu" onClick={() => markRead(n.id)}>
                      <i className="fa-solid fa-check"></i>
                    </button>
                  )}
                  <button className="notif-action-btn delete" title="Supprimer" onClick={() => deleteNotif(n.id)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
