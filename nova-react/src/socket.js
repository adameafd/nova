import { io } from 'socket.io-client';
import { ORIGIN } from './context/AuthContext';

let socket = null;

/**
 * Singleton : une seule connexion socket.io partagée
 * entre Sidebar, Accueil et Messagerie.
 */
export function getSocket() {
  if (!socket) {
    console.log('[socket] Création singleton — ORIGIN=', ORIGIN);
    socket = io(ORIGIN, { autoConnect: false });

    socket.on('connect', () =>
      console.log('[socket] ✓ CONNECTED  id=', socket.id, ' url=', ORIGIN)
    );
    socket.on('disconnect', (reason) =>
      console.log('[socket] ✗ DISCONNECTED  reason=', reason)
    );
    socket.on('connect_error', (err) =>
      console.error('[socket] ✗ CONNECT_ERROR:', err.message)
    );
  }
  return socket;
}
