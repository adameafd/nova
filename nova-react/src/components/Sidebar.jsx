import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import novaLogo from '../assets/nova.png';

const adminMenu = [
  { key: 'accueil', path: '/admin', icon: 'fa-house', label: 'Accueil' },
  { key: 'dashboard', path: '/admin/dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
  { key: 'controle', path: '/admin/control-unit', icon: 'fa-cogs', label: 'Unité de contrôle' },
  { key: 'users', path: '/admin/users', icon: 'fa-users', label: 'Utilisateurs' },
  { key: 'alerte', path: '/admin/alerts', icon: 'fa-triangle-exclamation', label: 'Alertes' },
  { key: 'interventions', path: '/admin/interventions', icon: 'fa-list-check', label: 'Interventions' },
  { key: 'stock', path: '/admin/stock', icon: 'fa-boxes-stacked', label: 'Stock' },
  { key: 'compte-rendu', path: '/admin/compte-rendu', icon: 'fa-file-arrow-up', label: 'Compte Rendu' },
  { key: 'messagerie', path: '/admin/messagerie', icon: 'fa-comment-dots', label: 'Messagerie' },
];

const techMenu = [
  { key: 'accueil', path: '/tech', icon: 'fa-house', label: 'Accueil' },
  { key: 'controle', path: '/tech/control-unit', icon: 'fa-cogs', label: 'Unité de contrôle' },
  { key: 'alerte', path: '/tech/alerts', icon: 'fa-triangle-exclamation', label: 'Alertes' },
  { key: 'interventions', path: '/tech/interventions', icon: 'fa-list-check', label: 'Interventions' },
  { key: 'stock', path: '/tech/stock', icon: 'fa-boxes-stacked', label: 'Stock' },
  { key: 'compte-rendu', path: '/tech/compte-rendu', icon: 'fa-file-arrow-up', label: 'Compte Rendu' },
  { key: 'messagerie', path: '/tech/messagerie', icon: 'fa-comment-dots', label: 'Messagerie' },
];

const dataMenu = [
  { key: 'accueil', path: '/data', icon: 'fa-house', label: 'Accueil' },
  { key: 'dashboard', path: '/data/dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
  { key: 'alertes-internes', path: '/data/alertes-internes', icon: 'fa-triangle-exclamation', label: 'Alertes internes' },
  { key: 'compte-rendu', path: '/data/compte-rendu', icon: 'fa-file-arrow-down', label: 'Compte Rendu' },
  { key: 'messagerie', path: '/data/messagerie', icon: 'fa-comment-dots', label: 'Messagerie' },
];

const entrepriseMenu = [
  { key: 'accueil', path: '/entreprise', icon: 'fa-house', label: 'Accueil' },
  { key: 'alerte', path: '/entreprise/alerts', icon: 'fa-triangle-exclamation', label: 'Mes alertes' },
];

export default function Sidebar({ role = 'admin', collapsed, onToggle, globalSearch }) {
  const location = useLocation();
  const { user, API_BASE } = useAuth();

  // Auto-close sidebar when a link is clicked on mobile
  // On mobile: collapsed=true means sidebar is open (the .active class makes it visible)
  const handleLinkClick = () => {
    if (window.innerWidth <= 768 && collapsed) {
      onToggle();
    }
  };
  const [totalUnread, setTotalUnread] = useState(0);
  const menu = role === 'admin' ? adminMenu : role === 'data' ? dataMenu : role === 'entreprise' ? entrepriseMenu : techMenu;

  // Filter menu items based on global search
  const filteredMenu = globalSearch
    ? menu.filter(item => item.label.toLowerCase().includes(globalSearch.trim().toLowerCase()))
    : menu;

  // ── Récupérer le nombre total de non lus ──
  const fetchUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/messages/summary?userId=${user.id}`);
      const data = await res.json();
      const total = (Array.isArray(data) ? data : [])
        .reduce((sum, s) => sum + (Number(s.unread_count) || 0), 0);
      setTotalUnread(total);
    } catch { /* ignore */ }
  }, [API_BASE, user?.id]);

  // Chargement initial
  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  // ── Socket.io : mise à jour temps réel du badge ──
  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('user:join', user.id);

    const onNewMessage = () => fetchUnread();
    const onConvUpdate = () => fetchUnread();

    socket.on('message:receive', onNewMessage);
    socket.on('conversations:update', onConvUpdate);

    return () => {
      socket.off('message:receive', onNewMessage);
      socket.off('conversations:update', onConvUpdate);
    };
  }, [user?.id, fetchUnread]);

  // ── CustomEvent : la Messagerie signale un mark-read ──
  useEffect(() => {
    const onUnreadUpdate = () => fetchUnread();
    window.addEventListener('unread-update', onUnreadUpdate);
    return () => window.removeEventListener('unread-update', onUnreadUpdate);
  }, [fetchUnread]);

  // ── Polling de secours (30s) ──
  useEffect(() => {
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  return (
    <nav className={`navigation${collapsed ? ' active' : ''}`} id="sidebar">
      <div>
        <div className="logo">
          <img src={novaLogo} alt="Logo NOVA" />
        </div>
        <ul className="menu" id="menu">
          {filteredMenu.map((item) => {
            const isActive = location.pathname === item.path;
            const isMessagerie = item.key === 'messagerie';
            return (
              <li key={item.key} className={isActive ? 'active' : ''}>
                <Link to={item.path} onClick={handleLinkClick}>
                  <span className="icon">
                    <i className={`fa-solid ${item.icon}`}></i>
                    {isMessagerie && totalUnread > 0 && (
                      <span className="sidebar-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
                    )}
                  </span>
                  <span className="title">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
