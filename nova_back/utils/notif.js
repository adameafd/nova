const pool      = require('../config/db');
const { getIo } = require('./socket');

/**
 * Crée une notification en DB puis l'émet en temps réel via Socket.IO.
 *
 * user_id = null  → broadcast (visible par TOUS via "user_id IS NULL")
 *                   + émis à tous les sockets connectés
 * user_id = N     → notification privée pour l'utilisateur N
 *                   + émis uniquement dans la room `user_N`
 *
 * @param {object}      opts
 * @param {number|null} opts.user_id  — destinataire ; null = broadcast
 * @param {string}      opts.type     — 'INFO','STOCK','COMPTE_RENDU','ALERTE','ALERTE_INTERNE','INTERVENTION'
 * @param {string|null} opts.title    — titre court affiché en gras
 * @param {string}      opts.message  — corps (obligatoire)
 * @param {string|null} opts.link     — slug page cible ('alertes','interventions','stock','compte-rendu','alertes-internes','messages')
 */
async function createNotif({ user_id = null, type = 'INFO', title = null, message, link = null }) {
  if (!message) return;

  const targetUserId = (user_id != null && !isNaN(Number(user_id))) ? Number(user_id) : null;

  console.log(
    `[notif] Insertion → user_id=${targetUserId ?? 'NULL(broadcast)'} type=${type} ` +
    `title="${title ?? '—'}" message="${message.substring(0, 60)}${message.length > 60 ? '…' : ''}"`
  );

  let insertId;

  try {
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
      [targetUserId, type, title ?? null, message, link ?? null]
    );
    insertId = result.insertId;
    console.log(`[notif] ✓ Créée id=${insertId} — type=${type} user_id=${targetUserId ?? 'NULL(broadcast)'}`);
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      // Fallback sans title/link si colonnes absentes
      console.warn('[notif] Fallback colonnes de base :', err.message);
      const [result] = await pool.query(
        'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
        [targetUserId, type, message]
      );
      insertId = result.insertId;
      console.log(`[notif] ✓ Créée (fallback) id=${insertId} — type=${type}`);
    } else {
      throw err;
    }
  }

  // ── Émission Socket.IO temps réel ───────────────────────────────────
  const io = getIo();
  if (io && insertId) {
    const notifData = {
      id:         insertId,
      user_id:    targetUserId,
      type,
      title:      title   ?? null,
      message,
      link:       link    ?? null,
      is_read:    0,
      created_at: new Date().toISOString(),
    };

    if (targetUserId === null) {
      // Broadcast → tous les clients connectés voient la notif
      io.emit('notification:new', notifData);
    } else {
      // Privée → seulement la room de cet utilisateur
      io.to(`user_${targetUserId}`).emit('notification:new', notifData);
    }

    console.log(`[notif] ✓ Émis socket — type=${type} target=${targetUserId ?? 'broadcast'}`);
  }
}

module.exports = { createNotif };
