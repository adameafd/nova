# Modele de base de donnees NOVA

## Diagramme relationnel

```
utilisateurs (1) ──── (N) alertes          (via technicien_id)
utilisateurs (1) ──── (N) messages         (via expediteur_id, destinataire_id)
utilisateurs (1) ──── (N) interventions    (via technicien_id)
utilisateurs (1) ──── (N) comptes_rendus   (via created_by)
utilisateurs (1) ──── (N) notifications    (via user_id)
```

## Tables

### utilisateurs
| Colonne             | Type         | Description                  |
|---------------------|--------------|------------------------------|
| id                  | INT PK AUTO  | Identifiant unique           |
| civilite            | VARCHAR(10)  | M. / Mme                    |
| nom                 | VARCHAR(100) | Nom complet                  |
| email               | VARCHAR(255) | Email (unique)               |
| mot_de_passe        | VARCHAR(255) | Mot de passe                 |
| role                | ENUM         | admin / technicien / data    |
| photo_url           | VARCHAR(500) | Chemin photo profil          |
| date_creation       | TIMESTAMP    | Date d'inscription           |
| statut_activite     | ENUM         | actif / inactif              |
| derniere_connexion  | DATETIME     | Derniere connexion           |

### alertes
| Colonne          | Type         | Description                     |
|------------------|--------------|---------------------------------|
| id               | INT PK AUTO  | Identifiant                     |
| source_type      | ENUM         | citoyen / entreprise            |
| nom_demandeur    | VARCHAR(100) | Nom du demandeur                |
| nom_entreprise   | VARCHAR(150) | Nom entreprise (si entreprise)  |
| email            | VARCHAR(255) | Email contact                   |
| type_alerte      | VARCHAR(50)  | panne / proposition / autre     |
| priorite         | ENUM         | basse / moyenne / haute         |
| description      | TEXT         | Description de l'alerte         |
| statut           | ENUM         | nouveau / en_cours / resolue    |
| technicien_id    | INT FK       | Technicien assigne              |
| date_creation    | TIMESTAMP    | Date de creation                |
| date_mise_a_jour | TIMESTAMP    | Derniere modification           |

### alertes_historique
Structure identique a `alertes` + `date_traitement`. Recoit les alertes resolues.

### messages
| Colonne          | Type        | Description              |
|------------------|-------------|--------------------------|
| id               | INT PK AUTO | Identifiant              |
| expediteur_id    | INT FK      | Auteur du message        |
| destinataire_id  | INT FK      | Destinataire             |
| contenu          | TEXT        | Corps du message         |
| date_envoi       | TIMESTAMP   | Date d'envoi             |
| lu               | TINYINT     | 0 = non lu, 1 = lu      |
| modifie          | TINYINT     | 0 = original, 1 = edite |

### stock
| Colonne       | Type         | Description                |
|---------------|--------------|----------------------------|
| id            | INT PK AUTO  | Identifiant                |
| nom           | VARCHAR(150) | Nom du materiel            |
| code          | VARCHAR(50)  | Code reference             |
| categorie     | VARCHAR(100) | Categorie (energie, etc.)  |
| quantite      | INT          | Quantite en stock          |
| seuil_alerte  | INT          | Seuil critique (defaut: 5) |
| total_utilise | INT          | Quantite totale utilisee   |

### interventions
| Colonne        | Type         | Description                       |
|----------------|--------------|-----------------------------------|
| id             | INT PK AUTO  | Identifiant                       |
| titre          | VARCHAR(200) | Titre de l'intervention           |
| description    | TEXT         | Details                           |
| priorite       | ENUM         | basse / moyenne / haute / critique|
| statut         | ENUM         | en_attente / en_cours / resolue / annulee |
| unite          | VARCHAR(100) | Unite concernee                   |
| technicien_id  | INT FK       | Technicien assigne                |
| date_creation  | TIMESTAMP    | Date de creation                  |
| date_maj       | TIMESTAMP    | Derniere modification             |

### comptes_rendus
| Colonne     | Type         | Description              |
|-------------|--------------|--------------------------|
| id          | INT PK AUTO  | Identifiant              |
| titre       | VARCHAR(255) | Titre du rapport         |
| type        | VARCHAR(100) | Type de rapport          |
| fichier_url | VARCHAR(500) | Chemin du fichier        |
| nom_fichier | VARCHAR(255) | Nom original du fichier  |
| created_by  | INT FK       | Auteur                   |
| created_at  | TIMESTAMP    | Date d'upload            |

### notifications
| Colonne    | Type        | Description                    |
|------------|-------------|--------------------------------|
| id         | INT PK AUTO | Identifiant                    |
| user_id    | INT FK NULL | Destinataire (NULL = global)   |
| type       | VARCHAR(50) | INFO / ALERTE / COMPTE_RENDU   |
| message    | TEXT        | Contenu                        |
| link       | VARCHAR(255)| Lien de redirection            |
| is_read    | TINYINT     | 0 = non lu, 1 = lu            |
| created_at | TIMESTAMP   | Date de creation               |

### releves_capteurs (historique IoT)
| Colonne     | Type         | Description                         |
|-------------|--------------|-------------------------------------|
| id          | INT PK AUTO  | Identifiant                         |
| capteur_id  | VARCHAR(50)  | Identifiant du capteur              |
| unite       | VARCHAR(30)  | Unite de mesure (C, %, dB, kWh)     |
| type_mesure | VARCHAR(50)  | temperature / humidite / co2 / etc. |
| valeur      | DECIMAL(10,2)| Valeur mesuree                      |
| timestamp   | TIMESTAMP    | Horodatage de la mesure             |

**Index** : `(capteur_id, timestamp)` et `(type_mesure, timestamp)` pour les requetes d'historique performantes.
