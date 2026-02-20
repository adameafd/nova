import { io } from 'socket.io-client';
import { ORIGIN } from './context/AuthContext';

let socket = null;

/**
 * Singleton : une seule connexion socket.io partagée
 * entre Sidebar et Messagerie (pas de double connexion).
 */
export function getSocket() {
  if (!socket) {
    socket = io(ORIGIN, { autoConnect: false });
  }
  return socket;
}
