/**
 * Connexion à nova_telemetry — base IoT séparée de nova.
 *
 * Tables : devices | mesures | supercap | batterie | systeme
 *
 * Comportement au démarrage :
 *  1. Connexion temporaire sans base spécifiée
 *  2. CREATE DATABASE IF NOT EXISTS nova_telemetry
 *  3. CREATE TABLE IF NOT EXISTS (5 tables)
 *  4. Création du pool définitif sur nova_telemetry
 */

const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_TELEMETRY_NAME || "nova_telemetry";

let _pool = null;

const _ready = (async () => {
  // 1. Connexion temporaire SANS base pour pouvoir la créer si besoin
  const tmp = await mysql.createConnection({
    host:     process.env.DB_HOST     || "localhost",
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "",
  });

  try {
    // 2. Créer la base si elle n'existe pas
    await tmp.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await tmp.query(`USE \`${DB_NAME}\``);

    // 3. Créer les tables
    await tmp.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id         INT           AUTO_INCREMENT PRIMARY KEY,
        device_id  VARCHAR(100)  NOT NULL UNIQUE,
        firmware   VARCHAR(50)   DEFAULT NULL,
        created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_id (device_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await tmp.query(`
      CREATE TABLE IF NOT EXISTS mesures (
        id           BIGINT        AUTO_INCREMENT PRIMARY KEY,
        device_id    VARCHAR(100)  NOT NULL,
        timestamp_ms BIGINT        NOT NULL,
        created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_ts      (device_id, timestamp_ms),
        INDEX idx_device_created (device_id, created_at),
        INDEX idx_created        (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await tmp.query(`
      CREATE TABLE IF NOT EXISTS supercap (
        id        BIGINT        AUTO_INCREMENT PRIMARY KEY,
        mesure_id BIGINT        NOT NULL,
        tension_V DECIMAL(6,4)  DEFAULT NULL,
        energie_J DECIMAL(10,4) DEFAULT NULL,
        FOREIGN KEY (mesure_id) REFERENCES mesures(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await tmp.query(`
      CREATE TABLE IF NOT EXISTS batterie (
        id        BIGINT        AUTO_INCREMENT PRIMARY KEY,
        mesure_id BIGINT        NOT NULL,
        tension_V DECIMAL(6,4)  DEFAULT NULL,
        courant_A DECIMAL(8,4)  DEFAULT NULL,
        etat      VARCHAR(20)   DEFAULT NULL,
        FOREIGN KEY (mesure_id) REFERENCES mesures(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await tmp.query(`
      CREATE TABLE IF NOT EXISTS systeme (
        id        BIGINT        AUTO_INCREMENT PRIMARY KEY,
        mesure_id BIGINT        NOT NULL,
        led_on    TINYINT(1)    DEFAULT NULL,
        status    VARCHAR(50)   DEFAULT NULL,
        FOREIGN KEY (mesure_id) REFERENCES mesures(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [tables] = await tmp.query("SHOW TABLES");
    const names = tables.map(r => Object.values(r)[0]);
    console.log(`[telemetry-db] Tables OK → [${names.join(", ")}]`);

  } finally {
    await tmp.end();
  }

  // 4. Pool définitif sur nova_telemetry
  _pool = mysql.createPool({
    host:               process.env.DB_HOST     || "localhost",
    user:               process.env.DB_USER     || "root",
    password:           process.env.DB_PASSWORD || "",
    database:           DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });

  console.log(`[telemetry-db] Connexion OK → ${DB_NAME}`);
  return _pool;
})().catch(err => {
  console.error("[telemetry-db] ERREUR init :", err.message);
  console.error("[telemetry-db] Vérifiez DB_HOST / DB_USER / DB_PASSWORD dans .env");
});

module.exports = {
  query:         (...args) => _ready.then(p => p.query(...args)),
  getConnection: ()        => _ready.then(p => p.getConnection()),
  get name() { return DB_NAME; },
};
