-- ================================================================
--  NOVA Smart City — Base de données IoT (séparée de nova)
--  Fichier  : nova_back/sql/init_telemetry.sql
--  Exécuter : mysql -u root -p < nova_back/sql/init_telemetry.sql
--          OU copier-coller dans MySQL Workbench / phpMyAdmin
-- ================================================================


-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 1 — Création de la base de données
-- ════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS nova_telemetry
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nova_telemetry;


-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 2 — Création des tables
-- ════════════════════════════════════════════════════════════════

-- ── Table 1 : devices ────────────────────────────────────────────
--  Registre de tous les ESP32 connus.
--  Mis à jour à chaque réception de données (last_seen, firmware).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id               INT           AUTO_INCREMENT PRIMARY KEY,
  device_id        VARCHAR(100)  NOT NULL UNIQUE,     -- ex: "esp32-energy-node-01"
  firmware_version VARCHAR(50)   DEFAULT NULL,        -- ex: "1.0.0"
  first_seen       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  last_seen        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Table 2 : telemetry ──────────────────────────────────────────
--  Une ligne = un message JSON reçu de l'ESP32.
--  Table "parent" : energy, battery, diagnostics en dépendent (FK).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry (
  id          BIGINT        AUTO_INCREMENT PRIMARY KEY,
  device_id   VARCHAR(100)  NOT NULL,
  ts_ms       BIGINT        NOT NULL,   -- timestamp du device (peut être en s ou ms)
  raw_payload JSON          DEFAULT NULL, -- payload brut complet pour debug
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_device_ts      (device_id, ts_ms),
  INDEX idx_device_created (device_id, created_at),
  INDEX idx_created        (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Table 3 : energy ─────────────────────────────────────────────
--  Métriques de production (harvesting) et consommation d'énergie.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS energy (
  id                  BIGINT        AUTO_INCREMENT PRIMARY KEY,
  telemetry_id        BIGINT        NOT NULL,          -- FK → telemetry.id
  device_id           VARCHAR(100)  NOT NULL,
  ts_ms               BIGINT        NOT NULL,

  -- Énergie récupérée (harvesting)
  provided_J          DECIMAL(10,4) DEFAULT NULL,      -- énergie fournie (Joules)
  supercap_voltage_V  DECIMAL(6,4)  DEFAULT NULL,      -- tension supercap (V)
  supercap_capacity_F DECIMAL(6,2)  DEFAULT NULL,      -- capacité supercap (F)
  ltc3588_output_V    DECIMAL(6,4)  DEFAULT NULL,      -- sortie convertisseur LTC3588

  -- Énergie consommée
  battery_current_A   DECIMAL(8,4)  DEFAULT NULL,      -- courant batterie (A)
  system_voltage_V    DECIMAL(6,4)  DEFAULT NULL,      -- tension système (V)
  power_W             DECIMAL(8,4)  DEFAULT NULL,      -- puissance instantanée (W)
  consumed_J          DECIMAL(10,4) DEFAULT NULL,      -- énergie consommée (Joules)

  INDEX idx_device_ts (device_id, ts_ms),
  FOREIGN KEY (telemetry_id) REFERENCES telemetry(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Table 4 : battery ────────────────────────────────────────────
--  État de la batterie à chaque mesure.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS battery (
  id                  BIGINT           AUTO_INCREMENT PRIMARY KEY,
  telemetry_id        BIGINT           NOT NULL,        -- FK → telemetry.id
  device_id           VARCHAR(100)     NOT NULL,
  ts_ms               BIGINT           NOT NULL,

  voltage_V           DECIMAL(6,4)     DEFAULT NULL,    -- tension batterie (V)
  percentage          TINYINT UNSIGNED DEFAULT NULL,    -- niveau de charge (0-100 %)
  protection_cutoff_V DECIMAL(6,4)     DEFAULT NULL,    -- seuil de coupure (V)
  charging            TINYINT(1)       DEFAULT 0,       -- 1 = en charge, 0 = décharge

  INDEX idx_device_ts (device_id, ts_ms),
  FOREIGN KEY (telemetry_id) REFERENCES telemetry(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Table 5 : diagnostics ────────────────────────────────────────
--  Informations de diagnostic du microcontrôleur.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostics (
  id               BIGINT        AUTO_INCREMENT PRIMARY KEY,
  telemetry_id     BIGINT        NOT NULL,              -- FK → telemetry.id
  device_id        VARCHAR(100)  NOT NULL,
  ts_ms            BIGINT        NOT NULL,

  acs712_raw       INT           DEFAULT NULL,          -- valeur brute capteur courant ACS712
  esp_wifi_active  TINYINT(1)    DEFAULT NULL,          -- 1 = WiFi actif
  esp_now_tx_ok    TINYINT(1)    DEFAULT NULL,          -- 1 = transmission ESP-NOW réussie
  mt3608_output_V  DECIMAL(6,4)  DEFAULT NULL,          -- sortie boost MT3608 (V)

  INDEX idx_device_ts (device_id, ts_ms),
  FOREIGN KEY (telemetry_id) REFERENCES telemetry(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 3 — Vérifications
-- ════════════════════════════════════════════════════════════════

-- Vérifier que la base nova_telemetry est bien créée
SHOW DATABASES LIKE 'nova_telemetry';

-- Vérifier que les 5 tables sont présentes
USE nova_telemetry;
SHOW TABLES;

-- Détail de chaque table (colonnes + types)
DESCRIBE devices;
DESCRIBE telemetry;
DESCRIBE energy;
DESCRIBE battery;
DESCRIBE diagnostics;


-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 4 — Données de test
--  (Simule un message JSON reçu de l'ESP32 "esp32-energy-node-01")
-- ════════════════════════════════════════════════════════════════

-- 4.1 Enregistrer le device
INSERT INTO devices (device_id, firmware_version)
VALUES ('esp32-energy-node-01', '1.0.0')
ON DUPLICATE KEY UPDATE
  firmware_version = VALUES(firmware_version),
  last_seen = NOW();

-- 4.2 Insérer l'enregistrement parent (telemetry)
INSERT INTO telemetry (device_id, ts_ms, raw_payload)
VALUES (
  'esp32-energy-node-01',
  1700000000,
  '{
    "device": {"id": "esp32-energy-node-01", "firmware_version": "1.0.0"},
    "timestamp_ms": 1700000000,
    "energy": {
      "provided_J": 1.85,
      "harvesting": {
        "supercap_voltage_V": 2.34,
        "supercap_capacity_F": 10,
        "ltc3588_output_V": 2.5
      },
      "consumed": {
        "battery_current_A": 0.182,
        "system_voltage_V": 5.0,
        "power_W": 0.91,
        "consumed_J": 4.52
      }
    },
    "battery": {
      "voltage_V": 3.78,
      "percentage": 74,
      "protection_cutoff_V": 2.5,
      "charging": false
    },
    "diagnostics": {
      "acs712_raw": 2012,
      "esp_wifi_active": true,
      "esp_now_tx_ok": true,
      "mt3608_output_V": 5.01
    }
  }'
);

-- Récupérer l'ID inséré pour les tables liées
SET @tel_id = LAST_INSERT_ID();

-- 4.3 Insérer les données énergie
INSERT INTO energy (
  telemetry_id, device_id, ts_ms,
  provided_J,
  supercap_voltage_V, supercap_capacity_F, ltc3588_output_V,
  battery_current_A, system_voltage_V, power_W, consumed_J
) VALUES (
  @tel_id, 'esp32-energy-node-01', 1700000000,
  1.85,
  2.34, 10.00, 2.5000,
  0.1820, 5.0000, 0.9100, 4.5200
);

-- 4.4 Insérer les données batterie
INSERT INTO battery (
  telemetry_id, device_id, ts_ms,
  voltage_V, percentage, protection_cutoff_V, charging
) VALUES (
  @tel_id, 'esp32-energy-node-01', 1700000000,
  3.7800, 74, 2.5000, 0
);

-- 4.5 Insérer les diagnostics
INSERT INTO diagnostics (
  telemetry_id, device_id, ts_ms,
  acs712_raw, esp_wifi_active, esp_now_tx_ok, mt3608_output_V
) VALUES (
  @tel_id, 'esp32-energy-node-01', 1700000000,
  2012, 1, 1, 5.0100
);


-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 5 — Requêtes de vérification des données insérées
-- ════════════════════════════════════════════════════════════════

-- Vue complète jointe (ce que le backend utilise)
SELECT
  t.id               AS telemetry_id,
  t.device_id,
  t.ts_ms,
  t.created_at,
  -- Énergie
  e.provided_J,
  e.supercap_voltage_V,
  e.supercap_capacity_F,
  e.ltc3588_output_V,
  e.battery_current_A,
  e.system_voltage_V,
  e.power_W,
  e.consumed_J,
  -- Batterie
  b.voltage_V        AS battery_voltage_V,
  b.percentage       AS battery_percentage,
  b.charging,
  -- Diagnostics
  d.acs712_raw,
  d.esp_wifi_active,
  d.esp_now_tx_ok,
  d.mt3608_output_V
FROM telemetry t
LEFT JOIN energy      e ON e.telemetry_id = t.id
LEFT JOIN battery     b ON b.telemetry_id = t.id
LEFT JOIN diagnostics d ON d.telemetry_id = t.id
ORDER BY t.created_at DESC;

-- Vérifier le device enregistré
SELECT * FROM devices;

-- Vérifier les FK (aucune ligne ne doit être orpheline)
SELECT
  t.id,
  t.device_id,
  CASE WHEN e.id IS NOT NULL THEN 'OK' ELSE 'MANQUANT' END AS energy_ok,
  CASE WHEN b.id IS NOT NULL THEN 'OK' ELSE 'MANQUANT' END AS battery_ok,
  CASE WHEN d.id IS NOT NULL THEN 'OK' ELSE 'MANQUANT' END AS diagnostics_ok
FROM telemetry t
LEFT JOIN energy      e ON e.telemetry_id = t.id
LEFT JOIN battery     b ON b.telemetry_id = t.id
LEFT JOIN diagnostics d ON d.telemetry_id = t.id;
