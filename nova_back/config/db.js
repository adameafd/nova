const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── mysql2 compatibility helpers ─────────────────────────────────────────────

/** Convert MySQL ?-placeholders to PostgreSQL $1, $2, … */
function toPostgresPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Wrap a pg result so it matches mysql2's destructuring convention:
 *   INSERT → [{ insertId, affectedRows }, []]
 *   UPDATE/DELETE → [{ affectedRows, changedRows }, []]
 *   SELECT → [rows, []]
 */
function wrapResult(pgResult, sql) {
  const trimmed = sql.trimStart().toUpperCase();
  if (trimmed.startsWith("INSERT")) {
    return [
      { insertId: pgResult.rows[0]?.id ?? null, affectedRows: pgResult.rowCount },
      [],
    ];
  }
  if (trimmed.startsWith("UPDATE") || trimmed.startsWith("DELETE")) {
    return [
      { affectedRows: pgResult.rowCount, changedRows: pgResult.rowCount },
      [],
    ];
  }
  return [pgResult.rows, []];
}

/**
 * Drop-in replacement for mysql2 pool.query(sql, params).
 * INSERT statements automatically get " RETURNING id" appended.
 */
async function query(sql, params = []) {
  let pgSql = toPostgresPlaceholders(sql);
  if (/^\s*INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
    pgSql += " RETURNING id";
  }
  const result = await pool.query(pgSql, params);
  return wrapResult(result, sql);
}

/**
 * Drop-in replacement for mysql2 pool.getConnection().
 * Returns a transaction-capable client with the same API surface.
 */
async function getConnection() {
  const client = await pool.connect();

  async function clientQuery(sql, params = []) {
    let pgSql = toPostgresPlaceholders(sql);
    if (/^\s*INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
      pgSql += " RETURNING id";
    }
    const result = await client.query(pgSql, params);
    return wrapResult(result, sql);
  }

  return {
    query:            clientQuery,
    beginTransaction: () => client.query("BEGIN"),
    commit:           () => client.query("COMMIT"),
    rollback:         () => client.query("ROLLBACK"),
    release:          () => client.release(),
  };
}

// ── Lightweight migrations (idempotent) ──────────────────────────────────────
// Only additive changes that may be missing on older deployments.
// PostgreSQL error codes: 42701 = duplicate column, 42P07 = table exists,
//                         42P01 = undefined table, 42703 = undefined column

async function runMigrations() {
  const migrations = [
    {
      name: "alertes_add_email",
      sql:  "ALTER TABLE alertes ADD COLUMN email VARCHAR(255) NULL",
    },
    {
      name: "alertes_historique_add_email",
      sql:  "ALTER TABLE alertes_historique ADD COLUMN email VARCHAR(255) NULL",
    },
    {
      name: "alertes_add_assigned_at",
      sql:  "ALTER TABLE alertes ADD COLUMN assigned_at TIMESTAMP NULL DEFAULT NULL",
    },
    {
      name: "interventions_add_source_type",
      sql:  "ALTER TABLE interventions ADD COLUMN source_type VARCHAR(10) NOT NULL DEFAULT 'manuelle' CHECK (source_type IN ('manuelle','alerte'))",
    },
    {
      name: "interventions_add_alerte_id",
      sql:  "ALTER TABLE interventions ADD COLUMN alerte_id INTEGER NULL DEFAULT NULL",
    },
    {
      name: "interventions_add_assigned_at",
      sql:  "ALTER TABLE interventions ADD COLUMN assigned_at TIMESTAMP NULL DEFAULT NULL",
    },
    {
      name: "alertes_type_norm_panne",
      sql:  "UPDATE alertes SET type_alerte = 'Panne ou dysfonctionnement' WHERE type_alerte = 'panne'",
    },
    {
      name: "alertes_type_norm_autre",
      sql:  "UPDATE alertes SET type_alerte = 'Autre' WHERE type_alerte = 'autre'",
    },
    {
      name: "alertes_type_norm_proposition",
      sql:  "UPDATE alertes SET type_alerte = 'Proposition d''amélioration' WHERE type_alerte = 'proposition'",
    },
  ];

  for (const migration of migrations) {
    try {
      await pool.query(migration.sql);
      console.log(`[Migration OK] ${migration.name}`);
    } catch (err) {
      if (err.code === "42701" || err.code === "42P07") {
        // duplicate column / table already exists — expected, skip silently
      } else if (err.code === "42P01") {
        console.warn(
          `[Migration SKIP] ${migration.name} — table dépendante introuvable :`,
          err.message
        );
      } else {
        console.error(
          `[Migration FAIL] ${migration.name} :`,
          err.code,
          err.message
        );
      }
    }
  }
}

runMigrations();

module.exports = { query, getConnection };
