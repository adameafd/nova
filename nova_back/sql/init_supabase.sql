-- ============================================================
-- NOVA Smart City — Schema complet PostgreSQL pour Supabase
-- Exécuter dans : Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── Fonctions trigger (remplacent ON UPDATE CURRENT_TIMESTAMP) ───────────────

CREATE OR REPLACE FUNCTION set_date_mise_a_jour()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_mise_a_jour = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_date_maj()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_maj = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. utilisateurs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                 SERIAL       PRIMARY KEY,
  civilite           VARCHAR(10)  DEFAULT NULL,
  nom                VARCHAR(100) NOT NULL,
  email              VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe       VARCHAR(255) NOT NULL,
  role               VARCHAR(20)  NOT NULL DEFAULT 'technicien'
                       CHECK (role IN ('admin','technicien','tech','data','entreprise')),
  photo_url          VARCHAR(500) DEFAULT NULL,
  date_creation      TIMESTAMP    DEFAULT NOW(),
  statut_activite    VARCHAR(20)  DEFAULT 'hors_ligne',
  derniere_connexion TIMESTAMP    DEFAULT NULL
);

-- ── 2. alertes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertes (
  id               SERIAL       PRIMARY KEY,
  source_type      VARCHAR(20)  NOT NULL DEFAULT 'citoyen'
                     CHECK (source_type IN ('citoyen','entreprise')),
  nom_demandeur    VARCHAR(100) DEFAULT NULL,
  nom_entreprise   VARCHAR(150) DEFAULT NULL,
  contact          VARCHAR(100) DEFAULT NULL,
  email            VARCHAR(255) DEFAULT NULL,
  unite_id         INTEGER      DEFAULT NULL,
  capteur_id       INTEGER      DEFAULT NULL,
  type_alerte      VARCHAR(50)  DEFAULT NULL,
  priorite         VARCHAR(10)  DEFAULT 'moyenne'
                     CHECK (priorite IN ('basse','moyenne','haute')),
  description      TEXT,
  statut           VARCHAR(20)  DEFAULT 'nouveau'
                     CHECK (statut IN ('nouveau','en_cours','resolue','traitee','annulee')),
  technicien_id    INTEGER      DEFAULT NULL REFERENCES utilisateurs(id) ON DELETE SET NULL,
  traite_par       INTEGER      DEFAULT NULL,
  cree_par         INTEGER      DEFAULT NULL,
  assigned_at      TIMESTAMP    DEFAULT NULL,
  date_creation    TIMESTAMP    DEFAULT NOW(),
  date_mise_a_jour TIMESTAMP    DEFAULT NOW()
);

CREATE TRIGGER alertes_ts
  BEFORE UPDATE ON alertes
  FOR EACH ROW EXECUTE FUNCTION set_date_mise_a_jour();

-- ── 3. alertes_historique ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertes_historique (
  id              SERIAL       PRIMARY KEY,
  source_type     VARCHAR(20)  DEFAULT NULL,
  nom_demandeur   VARCHAR(100) DEFAULT NULL,
  nom_entreprise  VARCHAR(150) DEFAULT NULL,
  contact         VARCHAR(100) DEFAULT NULL,
  email           VARCHAR(255) DEFAULT NULL,
  unite_id        INTEGER      DEFAULT NULL,
  capteur_id      INTEGER      DEFAULT NULL,
  type_alerte     VARCHAR(50)  DEFAULT NULL,
  priorite        VARCHAR(20)  DEFAULT NULL,
  description     TEXT,
  statut          VARCHAR(20)  DEFAULT NULL,
  date_creation   TIMESTAMP    DEFAULT NULL,
  date_traitement TIMESTAMP    DEFAULT NULL,
  cree_par        INTEGER      DEFAULT NULL,
  technicien_id   INTEGER      DEFAULT NULL,
  traite_par      INTEGER      DEFAULT NULL
);

-- ── 4. messages ──────────────────────────────────────────────────────────────
-- lu / modifie kept as SMALLINT (0/1) to match backend queries (= 0, = 1)
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL   PRIMARY KEY,
  expediteur_id   INTEGER  NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  destinataire_id INTEGER  NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  contenu         TEXT     NOT NULL,
  date_envoi      TIMESTAMP DEFAULT NOW(),
  lu              SMALLINT  DEFAULT 0,
  modifie         SMALLINT  DEFAULT 0
);

-- ── 5. stock ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock (
  id            SERIAL       PRIMARY KEY,
  nom           VARCHAR(150) NOT NULL,
  code          VARCHAR(50)  DEFAULT NULL,
  categorie     VARCHAR(100) DEFAULT NULL,
  quantite      INTEGER      DEFAULT 0,
  seuil_alerte  INTEGER      DEFAULT 5,
  total_utilise INTEGER      DEFAULT 0
);

-- ── 6. interventions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interventions (
  id            SERIAL       PRIMARY KEY,
  titre         VARCHAR(200) NOT NULL,
  description   TEXT,
  priorite      VARCHAR(10)  DEFAULT 'moyenne'
                  CHECK (priorite IN ('basse','moyenne','haute','critique')),
  statut        VARCHAR(20)  DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','en_cours','resolue','annulee')),
  unite         VARCHAR(100) DEFAULT NULL,
  technicien_id INTEGER      NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  source_type   VARCHAR(10)  NOT NULL DEFAULT 'manuelle'
                  CHECK (source_type IN ('manuelle','alerte')),
  alerte_id     INTEGER      DEFAULT NULL,
  assigned_at   TIMESTAMP    DEFAULT NULL,
  date_creation TIMESTAMP    DEFAULT NOW(),
  date_maj      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interventions_alerte_id ON interventions(alerte_id);

CREATE TRIGGER interventions_ts
  BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION set_date_maj();

-- ── 7. alertes_internes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertes_internes (
  id               SERIAL       PRIMARY KEY,
  categorie        VARCHAR(150) NOT NULL,
  priorite         VARCHAR(10)  NOT NULL DEFAULT 'basse'
                     CHECK (priorite IN ('basse','moyenne','haute')),
  description      TEXT,
  statut           VARCHAR(20)  NOT NULL DEFAULT 'en_cours'
                     CHECK (statut IN ('en_cours','traitee','annulee')),
  cree_par         INTEGER      NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  technicien_id    INTEGER      DEFAULT NULL REFERENCES utilisateurs(id) ON DELETE SET NULL,
  date_creation    TIMESTAMP    DEFAULT NOW(),
  date_mise_a_jour TIMESTAMP    DEFAULT NOW()
);

CREATE TRIGGER alertes_internes_ts
  BEFORE UPDATE ON alertes_internes
  FOR EACH ROW EXECUTE FUNCTION set_date_mise_a_jour();

-- ── 8. comptes_rendus ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comptes_rendus (
  id          SERIAL       PRIMARY KEY,
  titre       VARCHAR(255) DEFAULT NULL,
  type        VARCHAR(100) NOT NULL,
  fichier_url VARCHAR(500) NOT NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  created_by  INTEGER      NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- ── 9. notifications ─────────────────────────────────────────────────────────
-- is_read kept as SMALLINT (0/1) to match backend queries (SET is_read = 1)
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL       PRIMARY KEY,
  user_id    INTEGER      DEFAULT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type       VARCHAR(50)  NOT NULL DEFAULT 'INFO',
  title      VARCHAR(255) DEFAULT NULL,
  message    TEXT,
  link       VARCHAR(255) DEFAULT NULL,
  is_read    SMALLINT     NOT NULL DEFAULT 0,
  created_at TIMESTAMP    DEFAULT NOW()
);

-- ── 10. releves_capteurs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releves_capteurs (
  id          SERIAL        PRIMARY KEY,
  capteur_id  VARCHAR(50)   NOT NULL,
  unite       VARCHAR(30)   DEFAULT NULL,
  type_mesure VARCHAR(50)   NOT NULL,
  valeur      DECIMAL(10,2) NOT NULL,
  timestamp   TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capteur_time ON releves_capteurs(capteur_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_type_time    ON releves_capteurs(type_mesure, timestamp);

-- ── 11. Tables IoT telemetry ─────────────────────────────────────────────────
-- Schéma correspondant à telemetry.controller.js (mesures / supercap / batterie / systeme)

CREATE TABLE IF NOT EXISTS devices (
  id         SERIAL       PRIMARY KEY,
  device_id  VARCHAR(100) NOT NULL UNIQUE,
  firmware   VARCHAR(50)  DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_id ON devices(device_id);

CREATE TABLE IF NOT EXISTS mesures (
  id           BIGSERIAL    PRIMARY KEY,
  device_id    VARCHAR(100) NOT NULL,
  timestamp_ms BIGINT       NOT NULL,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mesures_device_ts      ON mesures(device_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_mesures_device_created ON mesures(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mesures_created        ON mesures(created_at);

CREATE TABLE IF NOT EXISTS supercap (
  id        BIGSERIAL     PRIMARY KEY,
  mesure_id BIGINT        NOT NULL REFERENCES mesures(id) ON DELETE CASCADE,
  tension_V DECIMAL(6,4)  DEFAULT NULL,
  energie_J DECIMAL(10,4) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS batterie (
  id        BIGSERIAL    PRIMARY KEY,
  mesure_id BIGINT       NOT NULL REFERENCES mesures(id) ON DELETE CASCADE,
  tension_V DECIMAL(6,4) DEFAULT NULL,
  courant_A DECIMAL(8,4) DEFAULT NULL,
  etat      VARCHAR(20)  DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS systeme (
  id        BIGSERIAL    PRIMARY KEY,
  mesure_id BIGINT       NOT NULL REFERENCES mesures(id) ON DELETE CASCADE,
  led_on    SMALLINT     DEFAULT NULL,
  status    VARCHAR(50)  DEFAULT NULL
);

-- ── Admin par défaut (mot de passe : admin123) ───────────────────────────────
INSERT INTO utilisateurs (nom, email, mot_de_passe, role)
VALUES ('Administrateur', 'admin@nova.fr', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;
