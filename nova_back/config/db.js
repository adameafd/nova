const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function runMigrations() {
  const migrations = [
    {
      name: "alertes_add_email",
      sql: "ALTER TABLE alertes ADD COLUMN email VARCHAR(255) NULL",
    },
    {
      name: "alertes_historique_add_email",
      sql: "ALTER TABLE alertes_historique ADD COLUMN email VARCHAR(255) NULL",
    },
    {
      name: "create_comptes_rendus",
      sql: `CREATE TABLE IF NOT EXISTS comptes_rendus (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titre VARCHAR(255) NULL,
        type VARCHAR(100) NOT NULL,
        fichier_url VARCHAR(500) NOT NULL,
        nom_fichier VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES utilisateurs(id) ON DELETE CASCADE
      )`,
    },
    {
      name: "create_notifications",
      sql: `CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'INFO',
        message TEXT NULL,
        link VARCHAR(255) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      name: "notif_v2_user_nullable",
      sql: "ALTER TABLE notifications MODIFY user_id INT NULL",
    },
    {
      name: "notif_v2_add_message",
      sql: "ALTER TABLE notifications ADD COLUMN message TEXT NULL",
    },
    {
      name: "notif_v2_title_nullable",
      sql: "ALTER TABLE notifications MODIFY COLUMN title VARCHAR(255) NULL DEFAULT NULL",
    },
  ];

  for (const migration of migrations) {
    try {
      await pool.query(migration.sql);
      console.log(`[Migration OK] ${migration.name}`);
    } catch (err) {
      if (
        err.code === "ER_DUP_FIELDNAME" ||
        err.code === "ER_TABLE_EXISTS_ERROR"
      ) {
        // Already exists, skip silently
      } else if (err.code === "ER_NO_SUCH_TABLE") {
        console.warn(
          `[Migration SKIP] ${migration.name} — table dependante introuvable :`,
          err.message
        );
      } else if (
        err.code === "ER_CANNOT_ADD_FOREIGN" ||
        err.code === "ER_FK_NO_INDEX_PARENT"
      ) {
        // FK failed — retry without FK constraint
        console.warn(
          `[Migration WARN] ${migration.name} — FK echouee, creation sans FK...`
        );
        try {
          await pool.query(`CREATE TABLE IF NOT EXISTS comptes_rendus (
            id INT AUTO_INCREMENT PRIMARY KEY,
            titre VARCHAR(255) NULL,
            type VARCHAR(100) NOT NULL,
            fichier_url VARCHAR(500) NOT NULL,
            nom_fichier VARCHAR(255) NOT NULL,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`);
          console.log(`[Migration OK] ${migration.name} (sans FK)`);
        } catch (err2) {
          console.error(
            `[Migration FAIL] ${migration.name} :`,
            err2.code,
            err2.message
          );
        }
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

module.exports = pool;
