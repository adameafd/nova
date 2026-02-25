/**
 * Singleton : stocke l'instance Socket.IO initialisée dans server.js
 * Permet à n'importe quel module (notif.js, controllers…) d'émettre
 * sans créer de dépendance circulaire.
 *
 * Usage :
 *   // server.js
 *   require('./utils/socket').setIo(io);
 *
 *   // n'importe quel module
 *   const { getIo } = require('./utils/socket');
 *   getIo()?.emit('event', data);
 */

let _io = null;

module.exports = {
  setIo: (io) => { _io = io; },
  getIo: ()   => _io,
};
