import { io } from 'socket.io-client';
import { ORIGIN } from './context/AuthContext';

// ── LOG MODULE : doit apparaître en console dès le chargement de la page ──
console.log('[socket.js] MODULE CHARGÉ — ORIGIN =', ORIGIN);

let socket = null;

/**
 * Singleton socket.io-client.
 * Le socket est créé une seule fois avec autoConnect:false.
 * La connexion est déclenchée par Sidebar (socket.connect() + user:join).
 */
export function getSocket() {
  if (!socket) {
    console.log('[socket.js] getSocket() — création de l\'instance');
    socket = io(ORIGIN, {
      autoConnect:       false,
      transports:        ['websocket', 'polling'], // essaie WebSocket en premier
      withCredentials:   true,
    });

    socket.on('connect', () =>
      console.log('[socket.js] ✓ CONNECTED  id =', socket.id, '  url =', ORIGIN)
    );
    socket.on('disconnect', (reason) =>
      console.log('[socket.js] ✗ DISCONNECTED  reason =', reason)
    );
    socket.on('connect_error', (err) =>
      console.error('[socket.js] ✗ CONNECT_ERROR:', err.message, '— URL tentée =', ORIGIN)
    );
  }
  return socket;
}
