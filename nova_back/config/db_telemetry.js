/**
 * Connexion telemetry IoT — PostgreSQL Supabase
 * Utilise la même base que l'app principale (même DATABASE_URL).
 * Tables : devices | mesures | supercap | batterie | systeme
 * Créer ces tables via Supabase SQL Editor (voir nova_back/sql/init_telemetry.sql).
 */

const { query, pool } = require("./db");

console.log("[telemetry-db] Connexion partagée Supabase (PostgreSQL)");

module.exports = {
  query,
  getConnection: () => pool.connect(),
  get name() { return process.env.DB_TELEMETRY_NAME || "nova_telemetry"; },
};
