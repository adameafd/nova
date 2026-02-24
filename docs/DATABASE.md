# Modèle de base de données NOVA

Le projet utilise **deux bases de données MySQL 8 distinctes** :
- `nova` — base principale (gestion de la plateforme)
- `nova_telemetry` — base IoT (données ESP32)

---

## Base principale : `nova`

### Diagramme relationnel

```
utilisateurs (1) ──── (N) alertes             (via technicien_id, cree_par, traite_par)
utilisateurs (1) ──── (N) alertes_internes    (via cree_par, technicien_id)
utilisateurs (1) ──── (N) messages            (via expediteur_id, destinataire_id)
utilisateurs (1) ──── (N) interventions       (via technicien_id)
utilisateurs (1) ──── (N) comptes_rendus      (via created_by)
utilisateurs (1) ──── (N) notifications       (via user_id, NULL = broadcast)
```

### Tables

---

#### utilisateurs

| Colonne            | Type                                          | Description                        |
|--------------------|-----------------------------------------------|------------------------------------|
| id                 | INT PK AUTO_INCREMENT                         | Identifiant unique                 |
| civilite           | VARCHAR(10) NULL                              | M. / Mme                           |
| nom                | VARCHAR(100) NOT NULL                         | Nom complet                        |
| email              | VARCHAR(255) NOT NULL UNIQUE                  | Email (unique)                     |
| mot_de_passe       | VARCHAR(255) NOT NULL                         | Mot de passe (stocké en clair)     |
| role               | ENUM('admin','technicien','data','entreprise') | Rôle utilisateur                  |
| photo_url          | VARCHAR(500) NULL                             | Chemin vers la photo de profil     |
| date_creation      | TIMESTAMP DEFAULT NOW                         | Date d'inscription                 |
| statut_activite    | VARCHAR(20) DEFAULT 'hors_ligne'              | actif / hors_ligne                 |
| derniere_connexion | DATETIME NULL                                 | Horodatage dernière connexion      |

---

#### alertes (alertes publiques — citoyen / entreprise)

| Colonne          | Type                                               | Description                              |
|------------------|----------------------------------------------------|------------------------------------------|
| id               | INT PK AUTO_INCREMENT                              | Identifiant                              |
| source_type      | ENUM('citoyen','entreprise') NOT NULL              | Source de l'alerte                       |
| nom_demandeur    | VARCHAR(100) NULL                                  | Nom du déclarant                         |
| nom_entreprise   | VARCHAR(150) NULL                                  | Nom entreprise (si source=entreprise)    |
| contact          | VARCHAR(100) NULL                                  | Téléphone ou autre contact               |
| email            | VARCHAR(255) NULL                                  | Email de contact                         |
| unite_id         | INT NULL                                           | Unité IoT concernée                      |
| capteur_id       | INT NULL                                           | Capteur concerné                         |
| type_alerte      | VARCHAR(50) NULL                                   | "Panne ou dysfonctionnement", "Proposition d'amélioration", "Autre" |
| priorite         | ENUM('basse','moyenne','haute') DEFAULT 'moyenne'  | Calculé automatiquement depuis type_alerte |
| description      | TEXT                                               | Détail de l'alerte                       |
| statut           | ENUM('nouveau','en_cours','resolue','traitee','annulee') DEFAULT 'nouveau' | Cycle de vie |
| technicien_id    | INT FK NULL → utilisateurs(id)                    | Technicien assigné                       |
| traite_par       | INT NULL                                           | ID de l'utilisateur ayant traité         |
| cree_par         | INT NULL                                           | ID utilisateur ayant créé (back-office)  |
| date_creation    | TIMESTAMP DEFAULT NOW                              | Date de création                         |
| date_mise_a_jour | TIMESTAMP ON UPDATE NOW                            | Dernière modification                    |

**Règle priorité** (calculée côté backend, non modifiable par le client) :
- `Panne ou dysfonctionnement` → `haute`
- `Proposition d'amélioration` → `moyenne`
- `Autre` → `basse`

**Cycle de vie** : `nouveau` → `en_cours` → `traitee` ou `resolue` → archivage.

---

#### alertes_historique (archive des alertes résolues)

Structure identique à `alertes` avec le champ supplémentaire :

| Colonne         | Type          | Description                          |
|-----------------|---------------|--------------------------------------|
| date_traitement | TIMESTAMP NULL| Date à laquelle l'alerte a été archivée |

> Les alertes dont le statut passe à `traitee` ou `annulee` restent dans la table `alertes`
> et sont filtrées côté frontend / via `GET /api/alertes/historique`.

---

#### alertes_internes (alertes internes entre employés)

Table dédiée créée **manuellement** (pas via migration automatique, voir section Migrations).

| Colonne          | Type                                          | Description                                |
|------------------|-----------------------------------------------|--------------------------------------------|
| id               | INT PK AUTO_INCREMENT                         | Identifiant                                |
| categorie        | VARCHAR(150) NOT NULL                         | Catégorie libre (ex: "Panne ascenseur A")  |
| priorite         | ENUM('basse','moyenne','haute') DEFAULT 'basse' | Priorité                                |
| description      | TEXT                                          | Détail de l'alerte                         |
| statut           | ENUM('en_cours','traitee','annulee') DEFAULT 'en_cours' | Statut                        |
| cree_par         | INT NOT NULL FK → utilisateurs(id) CASCADE    | Créateur de l'alerte                       |
| technicien_id    | INT NULL FK → utilisateurs(id) SET NULL       | Technicien assigné (optionnel)             |
| date_creation    | TIMESTAMP DEFAULT NOW                         | Date de création                           |
| date_mise_a_jour | TIMESTAMP ON UPDATE NOW                       | Dernière modification                      |

**Règles d'accès :**
- `admin` : voit toutes les alertes internes, peut modifier le statut de toutes.
- `technicien` / `data` : voient toutes les alertes internes, mais ne peuvent modifier le statut / supprimer que leurs propres alertes (`cree_par = user.id`).

**SQL de création (à exécuter manuellement) :**
```sql
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### messages

| Colonne         | Type                                | Description                   |
|-----------------|-------------------------------------|-------------------------------|
| id              | INT PK AUTO_INCREMENT               | Identifiant                   |
| expediteur_id   | INT FK → utilisateurs(id) CASCADE   | Auteur du message             |
| destinataire_id | INT FK → utilisateurs(id) CASCADE   | Destinataire                  |
| contenu         | TEXT NOT NULL                       | Corps du message              |
| date_envoi      | TIMESTAMP DEFAULT NOW               | Date d'envoi                  |
| lu              | TINYINT(1) DEFAULT 0                | 0 = non lu, 1 = lu            |
| modifie         | TINYINT(1) DEFAULT 0                | 0 = original, 1 = édité       |

---

#### stock

| Colonne       | Type          | Description                         |
|---------------|---------------|-------------------------------------|
| id            | INT PK AUTO   | Identifiant                         |
| nom           | VARCHAR(150)  | Nom du matériel                     |
| code          | VARCHAR(50)   | Code référence (généré depuis nom)  |
| categorie     | VARCHAR(100)  | Catégorie                           |
| quantite      | INT DEFAULT 0 | Quantité en stock                   |
| seuil_alerte  | INT DEFAULT 5 | Seuil déclenchant une notification  |
| total_utilise | INT DEFAULT 0 | Quantité totale utilisée            |

> Une notification `STOCK` broadcast est créée automatiquement quand `quantite <= seuil_alerte`.
> Anti-doublon : une seule notif STOCK non-lue par produit.

---

#### interventions

| Colonne        | Type                                               | Description                          |
|----------------|----------------------------------------------------|--------------------------------------|
| id             | INT PK AUTO                                        | Identifiant                          |
| titre          | VARCHAR(200) NOT NULL                              | Titre de l'intervention              |
| description    | TEXT                                               | Détails                              |
| priorite       | ENUM('basse','moyenne','haute','critique')         | Priorité                             |
| statut         | ENUM('en_attente','en_cours','resolue','annulee')  | Statut                               |
| unite          | VARCHAR(100) NULL                                  | Unité concernée                      |
| technicien_id  | INT FK NOT NULL → utilisateurs(id) CASCADE         | Technicien assigné                   |
| date_creation  | TIMESTAMP DEFAULT NOW                              | Date de création                     |
| date_maj       | TIMESTAMP ON UPDATE NOW                            | Dernière modification                |

---

#### comptes_rendus

| Colonne     | Type                               | Description              |
|-------------|------------------------------------|--------------------------|
| id          | INT PK AUTO                        | Identifiant              |
| titre       | VARCHAR(255) NULL                  | Titre du rapport         |
| type        | VARCHAR(100) NOT NULL              | Type de rapport          |
| fichier_url | VARCHAR(500) NOT NULL              | Chemin fichier (uploads) |
| nom_fichier | VARCHAR(255) NOT NULL              | Nom original du fichier  |
| created_by  | INT FK → utilisateurs(id) CASCADE  | Auteur                   |
| created_at  | TIMESTAMP DEFAULT NOW              | Date d'upload            |

---

#### notifications

| Colonne    | Type                   | Description                                             |
|------------|------------------------|---------------------------------------------------------|
| id         | INT PK AUTO            | Identifiant                                             |
| user_id    | INT FK NULL            | Destinataire. `NULL` = **broadcast** (visible par tous) |
| type       | VARCHAR(50) DEFAULT 'INFO' | INFO / ALERTE / ALERTE_INTERNE / STOCK / COMPTE_RENDU / INTERVENTION |
| title      | VARCHAR(255) NULL      | Titre court affiché en gras                             |
| message    | TEXT                   | Corps de la notification                                |
| link       | VARCHAR(255) NULL      | Slug de navigation cible                                |
| is_read    | TINYINT(1) DEFAULT 0   | 0 = non lue, 1 = lue                                   |
| created_at | TIMESTAMP DEFAULT NOW  | Date de création                                        |

**Logique broadcast :** La requête frontend filtre `WHERE user_id = ? OR user_id IS NULL`,
donc toute notification avec `user_id = NULL` est visible par admin, technicien ET data.

**Déclencheurs automatiques :**

| Événement             | type           | user_id    | link              |
|-----------------------|----------------|------------|-------------------|
| Nouvelle alerte       | ALERTE         | NULL       | alertes           |
| Alerte interne créée  | ALERTE_INTERNE | NULL       | alertes-internes  |
| Intervention créée    | INTERVENTION   | NULL       | interventions     |
| Intervention assignée | INTERVENTION   | technicien | interventions     |
| Stock faible/rupture  | STOCK          | NULL       | stock             |
| Compte rendu déposé   | COMPTE_RENDU   | NULL       | compte-rendu      |
| Message reçu          | INFO           | destinataire | messages        |

---

#### releves_capteurs (historique IoT — table legacy)

| Colonne     | Type            | Description                             |
|-------------|-----------------|-----------------------------------------|
| id          | INT PK AUTO     | Identifiant                             |
| capteur_id  | VARCHAR(50)     | Identifiant du capteur                  |
| unite       | VARCHAR(30)     | Unité de mesure (°C, %, dB, kWh)       |
| type_mesure | VARCHAR(50)     | temperature / humidite / co2 / bruit    |
| valeur      | DECIMAL(10,2)   | Valeur mesurée                          |
| timestamp   | TIMESTAMP       | Horodatage de la mesure                 |

**Index** : `(capteur_id, timestamp)` et `(type_mesure, timestamp)`.

---

## Base IoT : `nova_telemetry`

Base de données dédiée aux données de télémétrie reçues des modules ESP32.
Fichier de création : `nova_back/sql/init_telemetry.sql`

### Diagramme relationnel

```
devices   (1) ──── (N) mesures     (via device_id)
mesures   (1) ──── (1) supercap    (via mesure_id FK CASCADE)
mesures   (1) ──── (1) batterie    (via mesure_id FK CASCADE)
mesures   (1) ──── (1) systeme     (via mesure_id FK CASCADE)
```

### Tables

---

#### devices (registre des ESP32)

| Colonne         | Type         | Description                          |
|-----------------|--------------|--------------------------------------|
| id              | INT PK AUTO  | Identifiant interne                  |
| device_id       | VARCHAR(100) UNIQUE NOT NULL | ex: "esp32-harvester-1" |
| firmware        | VARCHAR(50) NULL | Version firmware ESP32            |
| created_at      | TIMESTAMP DEFAULT NOW | Première vue                 |
| last_seen       | TIMESTAMP ON UPDATE NOW | Dernière mise à jour        |

> Mis à jour par upsert à chaque réception de données (`ON DUPLICATE KEY UPDATE firmware`).

---

#### mesures (enregistrement parent — une ligne = un message ESP32)

| Colonne      | Type         | Description                                        |
|--------------|--------------|----------------------------------------------------|
| id           | BIGINT PK AUTO | Identifiant                                      |
| device_id    | VARCHAR(100) NOT NULL | Identifiant du device                     |
| timestamp_ms | BIGINT NOT NULL | Timestamp du device (millisecondes ou secondes) |
| created_at   | TIMESTAMP DEFAULT NOW | Date de réception serveur              |

**Index** : `(device_id, timestamp_ms)`, `(device_id, created_at)`, `(created_at)`

---

#### supercap (données supercondensateur)

| Colonne    | Type         | Description                          |
|------------|--------------|--------------------------------------|
| id         | BIGINT PK AUTO | Identifiant                        |
| mesure_id  | BIGINT FK → mesures(id) CASCADE | Parent         |
| tension_V  | DECIMAL(6,4) NULL | Tension supercap (V)           |
| energie_J  | DECIMAL(10,4) NULL | Énergie stockée (Joules)       |

---

#### batterie (état de la batterie)

| Colonne   | Type         | Description                          |
|-----------|--------------|--------------------------------------|
| id        | BIGINT PK AUTO | Identifiant                        |
| mesure_id | BIGINT FK → mesures(id) CASCADE | Parent         |
| tension_V | DECIMAL(6,4) NULL | Tension batterie (V)           |
| courant_A | DECIMAL(8,4) NULL | Courant batterie (A)            |
| etat      | VARCHAR(20) NULL | Direction : "charge" / "discharge" |

---

#### systeme (état du système ESP32)

| Colonne   | Type         | Description                          |
|-----------|--------------|--------------------------------------|
| id        | BIGINT PK AUTO | Identifiant                        |
| mesure_id | BIGINT FK → mesures(id) CASCADE | Parent         |
| led_on    | TINYINT(1) NULL | État LED (1 = allumée)            |
| status    | VARCHAR(50) NULL | Statut système (ex: "OK")        |

### Payload JSON ESP32 → Mapping BDD

```
Payload reçu                    → Table cible
─────────────────────────────────────────────
device.id                       → devices.device_id
device.firmware                 → devices.firmware
timestamp_ms                    → mesures.timestamp_ms
supercap.voltage                → supercap.tension_V
supercap.energy_j               → supercap.energie_J
battery.voltage                 → batterie.tension_V
battery.current_a               → batterie.courant_A
battery.direction               → batterie.etat
system.led_on                   → systeme.led_on
system.status                   → systeme.status
```

---

## Migrations (base nova)

Le fichier `nova_back/config/db.js` exécute des migrations **idempotentes** au démarrage
(les erreurs `ER_DUP_FIELDNAME` et `ER_TABLE_EXISTS_ERROR` sont ignorées silencieusement).

La table `alertes_internes` n'est **pas** créée par migration automatique (problème FK errno 150
sur certains environnements MySQL). Elle doit être créée manuellement via le SQL fourni ci-dessus.

Pour nettoyer une base existante qui aurait des colonnes résiduelles d'anciennes migrations :
```sql
-- Seulement si ces colonnes existent déjà
ALTER TABLE alertes DROP COLUMN IF EXISTS is_interne;
ALTER TABLE alertes DROP COLUMN IF EXISTS categorie;
UPDATE alertes SET source_type = 'citoyen'
  WHERE source_type NOT IN ('citoyen', 'entreprise');
ALTER TABLE alertes MODIFY COLUMN source_type
  ENUM('citoyen', 'entreprise') NOT NULL DEFAULT 'citoyen';
```
