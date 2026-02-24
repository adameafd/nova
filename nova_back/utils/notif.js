const pool = require('../config/db');

/**
 * Crée une notification.
 *
 * user_id = null  → broadcast (visible par TOUS les utilisateurs via "user_id IS NULL")
 * user_id = N     → notification privée pour l'utilisateur N
 *
 * Fallback automatique si les colonnes title/link sont absentes.
 *
 * @param {object}      opts
 * @param {number|null} opts.user_id  - destinataire ; null = broadcast (admin + tech + data)
 * @param {string}      opts.type     - 'INFO', 'STOCK', 'COMPTE_RENDU', 'ALERTE', 'ALERTE_INTERNE', 'INTERVENTION'
 * @param {string|null} opts.title    - titre court affiché en gras
 * @param {string}      opts.message  - corps de la notification (obligatoire)
 * @param {string|null} opts.link     - slug de la page cible ('stock', 'messages', 'alertes-internes'…)
 */
async function createNotif({ user_id = null, type = 'INFO', title = null, message, link = null }) {
  if (!message) return;

  // null = broadcast (user_id IS NULL en base → visible par tous)
  // number = notification privée
  const targetUserId = (user_id != null && !isNaN(Number(user_id))) ? Number(user_id) : null;

  console.log(
    `[notif] Insertion → user_id=${targetUserId ?? 'NULL(broadcast)'} type=${type} ` +
    `title="${title ?? '—'}" message="${message.substring(0, 60)}${message.length > 60 ? '…' : ''}"`
  );

  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
      [targetUserId, type, title ?? null, message, link ?? null]
    );
    console.log(`[notif] ✓ Créée — type=${type} user_id=${targetUserId ?? 'NULL(broadcast)'}`);
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      // Colonne title ou link absente → fallback colonnes garanties par init.sql
      console.warn('[notif] Fallback colonnes de base (title/link absent) :', err.message);
      await pool.query(
        'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
        [targetUserId, type, message]
      );
      console.log(`[notif] ✓ Créée (fallback) — type=${type} user_id=${targetUserId ?? 'NULL(broadcast)'}`);
    } else {
      throw err;
    }
  }
}

module.exports = { createNotif };
