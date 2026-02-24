-- ============================================
-- NOVA Smart City — Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS nova;
USE nova;

-- Users
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  civilite VARCHAR(10) DEFAULT NULL,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role ENUM('admin', 'technicien', 'data', 'entreprise') NOT NULL DEFAULT 'technicien',
  photo_url VARCHAR(500) DEFAULT NULL,
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  statut_activite VARCHAR(20) DEFAULT 'hors_ligne',
  derniere_connexion DATETIME DEFAULT NULL
);

-- Active alerts
CREATE TABLE IF NOT EXISTS alertes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_type ENUM('citoyen', 'entreprise') NOT NULL DEFAULT 'citoyen',
  nom_demandeur VARCHAR(100) DEFAULT NULL,
  nom_entreprise VARCHAR(150) DEFAULT NULL,
  contact VARCHAR(100) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  unite_id INT DEFAULT NULL,
  capteur_id INT DEFAULT NULL,
  type_alerte VARCHAR(50) DEFAULT NULL,
  priorite ENUM('basse', 'moyenne', 'haute') DEFAULT 'moyenne',
  description TEXT,
  statut ENUM('nouveau', 'en_cours', 'resolue', 'traitee', 'annulee') DEFAULT 'nouveau',
  technicien_id INT DEFAULT NULL,
  traite_par INT DEFAULT NULL,
  cree_par INT DEFAULT NULL,
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_mise_a_jour TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (technicien_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- Archived (resolved) alerts
CREATE TABLE IF NOT EXISTS alertes_historique (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(20) DEFAULT NULL,
  nom_demandeur VARCHAR(100) DEFAULT NULL,
  nom_entreprise VARCHAR(150) DEFAULT NULL,
  contact VARCHAR(100) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  unite_id INT DEFAULT NULL,
  capteur_id INT DEFAULT NULL,
  type_alerte VARCHAR(50) DEFAULT NULL,
  priorite VARCHAR(20) DEFAULT NULL,
  description TEXT,
  statut VARCHAR(20) DEFAULT NULL,
  date_creation TIMESTAMP NULL,
  date_traitement TIMESTAMP NULL,
  cree_par INT DEFAULT NULL,
  technicien_id INT DEFAULT NULL,
  traite_par INT DEFAULT NULL
);

-- Messages (direct messaging)
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expediteur_id INT NOT NULL,
  destinataire_id INT NOT NULL,
  contenu TEXT NOT NULL,
  date_envoi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lu TINYINT(1) DEFAULT 0,
  modifie TINYINT(1) DEFAULT 0,
  FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Stock / Inventory
CREATE TABLE IF NOT EXISTS stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  categorie VARCHAR(100) DEFAULT NULL,
  quantite INT DEFAULT 0,
  seuil_alerte INT DEFAULT 5,
  total_utilise INT DEFAULT 0
);

-- Interventions
CREATE TABLE IF NOT EXISTS interventions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titre VARCHAR(200) NOT NULL,
  description TEXT,
  priorite ENUM('basse', 'moyenne', 'haute', 'critique') DEFAULT 'moyenne',
  statut ENUM('en_attente', 'en_cours', 'resolue', 'annulee') DEFAULT 'en_attente',
  unite VARCHAR(100) DEFAULT NULL,
  technicien_id INT NOT NULL,
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (technicien_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Internal alerts (between employees)
CREATE TABLE IF NOT EXISTS alertes_internes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categorie VARCHAR(150) NOT NULL,
  priorite ENUM('basse','moyenne','haute') NOT NULL DEFAULT 'basse',
  description TEXT,
  statut ENUM('en_cours','traitee','annulee') NOT NULL DEFAULT 'en_cours',
  cree_par INT NOT NULL,
  technicien_id INT DEFAULT NULL,
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_mise_a_jour TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (technicien_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- Reports
CREATE TABLE IF NOT EXISTS comptes_rendus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titre VARCHAR(255) DEFAULT NULL,
  type VARCHAR(100) NOT NULL,
  fichier_url VARCHAR(500) NOT NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'INFO',
  title VARCHAR(255) DEFAULT NULL,
  message TEXT,
  link VARCHAR(255) DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Sensor readings history (IoT data)
CREATE TABLE IF NOT EXISTS releves_capteurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  capteur_id VARCHAR(50) NOT NULL,
  unite VARCHAR(30) DEFAULT NULL,
  type_mesure VARCHAR(50) NOT NULL COMMENT 'temperature, humidite, co2, bruit, energie',
  valeur DECIMAL(10,2) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_capteur_time (capteur_id, timestamp),
  INDEX idx_type_time (type_mesure, timestamp)
);

-- ============================================
-- Migration : statut_activite & alertes.statut
-- À exécuter UNE FOIS sur une DB existante
-- ============================================
ALTER TABLE utilisateurs
  MODIFY COLUMN statut_activite VARCHAR(20) DEFAULT 'hors_ligne';

ALTER TABLE alertes
  MODIFY COLUMN statut ENUM('nouveau','en_cours','resolue','traitee','annulee') DEFAULT 'nouveau';

-- ============================================
-- Migration : ajout rôle entreprise
-- À exécuter UNE FOIS sur une DB existante
-- ============================================
ALTER TABLE utilisateurs
  MODIFY COLUMN role ENUM('admin', 'technicien', 'data', 'entreprise') NOT NULL DEFAULT 'technicien';

-- ============================================
-- Default admin user (password: admin123)
-- ============================================
INSERT INTO utilisateurs (nom, email, mot_de_passe, role)
VALUES ('Administrateur', 'admin@nova.fr', 'admin123', 'admin')
ON DUPLICATE KEY UPDATE nom=nom;
