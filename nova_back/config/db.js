// ── PostgreSQL (Supabase) — shim de compatibilité mysql2 ────────────────────
// Ce fichier remplace mysql2 par pg tout en gardant la même interface :
//   const [rows]   = await db.query("SELECT ...", [params])
//   const [result] = await db.query("INSERT ...", [params]) → result.insertId
//   const [result] = await db.query("UPDATE ...", [params]) → result.affectedRows
// ─────────────────────────────────────────────────────────────────────────────
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // obligatoire pour Supabase
});

pool.on("error", (err) => {
  console.error("[pg] Erreur pool inattendue :", err.message);
});

/**
 * Shim mysql2-compatible :
 *  - convertit les placeholders ? → $1, $2, ...
 *  - ajoute RETURNING id automatiquement sur les INSERT (pour insertId)
 *  - retourne [rows] pour SELECT, [{ insertId, affectedRows }] pour le reste
 */
async function query(text, params = []) {
  // 1. ? → $N
  let idx = 0;
  let pgText = text.replace(/\?/g, () => `$${++idx}`);

  // 2. INSERT sans RETURNING → ajoute RETURNING id
  const isInsert = /^\s*INSERT\b/i.test(pgText);
  if (isInsert && !/\bRETURNING\b/i.test(pgText)) {
    pgText += " RETURNING id";
  }

  const result = await pool.query(pgText, params);

  // 3. Retourne dans le format mysql2 attendu par les routes
  if (result.command === "SELECT") {
    return [result.rows];
  }
  if (result.command === "INSERT") {
    return [{ insertId: result.rows?.[0]?.id ?? null, affectedRows: result.rowCount }];
  }
  // UPDATE, DELETE
  return [{ affectedRows: result.rowCount, insertId: null }];
}

module.exports = { query, pool };
