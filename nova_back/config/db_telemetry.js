/**
 * db_telemetry — IoT database layer.
 *
 * Migrated to Supabase/PostgreSQL: IoT tables (devices, mesures,
 * supercap, batterie, systeme) now live in the same Supabase database
 * as the rest of NOVA. This module simply re-exports the main pg pool.
 */

const db = require("./db");

module.exports = {
  query:         db.query,
  getConnection: db.getConnection,
  get name() { return process.env.SUPABASE_URL || "supabase (nova)"; },
};
