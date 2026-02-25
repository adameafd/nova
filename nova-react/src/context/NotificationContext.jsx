/**
 * NotificationContext — état global des notifications
 *
 * Le listener Socket.IO "notification:new" vit ICI, au niveau de l'arbre React,
 * pas dans les pages Accueil. Ainsi il reste actif même quand l'utilisateur
 * navigue vers Alertes / Interventions / etc. pour faire une action.
 *
 * Toutes les pages Accueil utilisent useNotifications() pour lire l'état
 * et n'ont plus besoin de gérer elles-mêmes le polling ou le socket.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSocket } from '../socket';

const NotificationContext = createContext({
  notifications:    [],
  setNotifications: () => {},
  unreadCount:      0,
  reload:           async () => {},
  markAllRead:      async () => {},
});

export function NotificationProvider({ children }) {
  const { user, API_BASE } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const userId = Number(user?.id) || null;

  // ── Chargement depuis l'API ──────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/latest?userId=${userId}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      console.log('[NotifCtx] reload → ', data.length, 'notification(s)');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[NotifCtx] reload error:', err.message);
    }
  }, [API_BASE, userId]);

  // Chargement initial dès que userId est dispo
  useEffect(() => {
    if (userId) reload();
  }, [userId, reload]);

  // Polling de secours toutes les 15s (au cas où un event socket serait manqué)
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(reload, 15000);
    return () => clearInterval(id);
  }, [userId, reload]);

  // ── Socket.IO — listener GLOBAL, persiste toute la session ──────────
  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();
    console.log(
      `[NotifCtx] enregistrement listener notification:new | userId=${userId} | socket.connected=${socket.connected} | socketId=${socket.id ?? 'non connecté'}`
    );

    const onNewNotif = (notif) => {
      console.log('[NotifCtx] ← notification:new reçue :', notif);
      setNotifications(prev => {
        if (prev.some(n => n.id === notif.id)) return prev;   // déduplique
        return [notif, ...prev].slice(0, 10);
      });
    };

    socket.on('notification:new', onNewNotif);

    return () => {
      socket.off('notification:new', onNewNotif);
      console.log('[NotifCtx] listener notification:new retiré (démontage)');
    };
  }, [userId]);

  // ── Marquer tout comme lu ────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('[NotifCtx] markAllRead error:', err.message);
    }
  }, [API_BASE, userId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, setNotifications, unreadCount, reload, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
