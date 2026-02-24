# NOVA — Smart City Management Platform

Plateforme de gestion de ville intelligente permettant le suivi des alertes citoyennes,
la gestion des interventions techniques, la messagerie interne et le monitoring IoT.

## Stack technique

| Couche           | Technologie                  |
|------------------|------------------------------|
| Frontend         | React 19 + Vite 7            |
| Backend          | Node.js + Express 5          |
| Base de données  | MySQL 8                      |
| Temps réel       | Socket.io                    |
| Upload           | Multer                       |
| Graphiques       | Chart.js                     |
| Container        | Docker + Docker Compose      |
| Tests            | Vitest + Testing Library     |
| API Docs         | Swagger / OpenAPI 3.0        |

## Architecture

```
┌──────────────────┐     HTTP / WS     ┌──────────────────┐     SQL     ┌─────────┐
│   React SPA      │ ◄──────────────► │   Express API    │ ◄────────► │  MySQL  │
│   (port 80)      │                   │   (port 3000)    │            │  (3306) │
└──────────────────┘                   └──────────────────┘            └─────────┘
                                              ▲
                                              │ MQTT (prévu)
                                       ┌──────┴──────┐
                                       │  Capteurs   │
                                       │  IoT        │
                                       └─────────────┘
```

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le détail complet.
Voir [docs/DATABASE.md](docs/DATABASE.md) pour le schéma de base de données.

## Fonctionnalités

### Administration (rôle : admin)
- **Dashboard** : graphiques temps réel (alertes, stock critique, interventions)
- **Alertes publiques** : réception, tri par priorité, assignation aux techniciens, historique
- **Alertes internes** : création, modification du statut sur toutes les alertes, suppression
- **Interventions** : création, suivi, changement de statut/priorité
- **Messagerie** : messagerie directe avec badges non-lus
- **Stock** : CRUD inventaire, seuil d'alerte automatique
- **Utilisateurs** : gestion des comptes (CRUD + photo de profil)
- **Comptes rendus** : consultation et suppression des rapports uploadés
- **Unité de contrôle** : monitoring des capteurs et unités

### Technicien (rôle : technicien)
- Alertes publiques assignées (changement de statut)
- Alertes internes : voir tout, créer, modifier/supprimer les siennes
- Interventions assignées
- Messagerie interne
- Gestion du stock

### Équipe Data (rôle : data)
- Dashboard analytique
- Alertes internes : voir tout, créer, modifier/supprimer les siennes
- Upload de comptes rendus (PDF, Excel, images)
- Messagerie interne

### Public
- Page d'accueil, À propos, Contact
- Formulaire de signalement d'alerte (citoyen / entreprise)
- Formulaire de connexion

## Installation locale

### Prérequis
- Node.js >= 18
- MySQL 8
- npm

### 1. Base de données
```bash
mysql -u root -p < nova_back/sql/init.sql
```

Puis créer manuellement la table `alertes_internes` (voir [docs/DATABASE.md](docs/DATABASE.md#alertes_internes)).

### 2. Backend
```bash
cd nova_back
cp .env.example .env    # Configurer les variables
npm install
npm run dev             # Démarre sur http://localhost:3000
```

### 3. Frontend
```bash
cd nova-react
npm install
npm run dev             # Démarre sur http://localhost:5173
```

### 4. Documentation API
Démarrer le backend puis ouvrir : http://localhost:3000/api-docs

## Variables d'environnement (nova_back/.env)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=nova
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

## Installation Docker

```bash
docker-compose up --build
```

Services :
- Frontend  : http://localhost
- Backend API : http://localhost:3000
- API Docs  : http://localhost:3000/api-docs
- MySQL     : localhost:3306

## Tests

```bash
cd nova-react
npm test            # Mode watch
npm run test:run    # Exécution unique (CI)
```

## Structure du projet

```
Nova---406-main/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── ARCHITECTURE.md       # Architecture système + flux de données
│   └── DATABASE.md           # Schéma complet de la BDD
├── nova_back/                # API Backend
│   ├── Dockerfile
│   ├── .env.example
│   ├── server.js             # Point d'entrée + Socket.io
│   ├── app.js                # Express app + routes
│   ├── swagger.js            # Documentation OpenAPI 3.0
│   ├── config/
│   │   └── db.js             # Pool MySQL + migrations idempotentes
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── utilisateurs.controller.js
│   │   ├── alertes.controller.js
│   │   └── stock.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── utilisateurs.routes.js
│   │   ├── alertes.routes.js         # Alertes publiques + /interne
│   │   ├── messages.routes.js
│   │   ├── stock.routes.js
│   │   ├── interventions.routes.js
│   │   ├── comptesRendus.routes.js
│   │   └── notifications.routes.js
│   ├── middlewares/
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── utils/
│   │   └── notif.js          # createNotif() — utilitaire centralisé notifications
│   ├── sql/
│   │   └── init.sql          # Schéma complet (sans alertes_internes)
│   └── uploads/              # Fichiers uploadés
├── nova-react/               # Frontend React
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx           # Routing principal
│   │   ├── context/          # AuthContext, ThemeContext
│   │   ├── components/       # Composants réutilisables
│   │   │   ├── Layout.jsx
│   │   │   ├── PublicLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopBar.jsx
│   │   │   ├── ProfileModal.jsx
│   │   │   ├── ConfirmModal.jsx
│   │   │   └── NotificationsDropdown.jsx
│   │   ├── pages/
│   │   │   ├── admin/        # 10 pages (dont AlertesInternes)
│   │   │   ├── tech/         # 7 pages (dont AlertesInternes)
│   │   │   ├── data/         # 5 pages (dont AlertesInternes)
│   │   │   └── public/       # 4 pages
│   │   ├── utils/
│   │   │   └── helpers.js    # Fonctions utilitaires
│   │   ├── css/              # Styles par module
│   │   ├── assets/           # Images
│   │   └── test/             # Tests unitaires
│   │       ├── setup.js
│   │       ├── helpers.test.js
│   │       └── ConfirmModal.test.jsx
│   └── public/
└── .gitignore
```

## API Endpoints

### Authentification
| Méthode | Route       | Description          |
|---------|-------------|----------------------|
| POST    | /api/login  | Connexion utilisateur|
| POST    | /api/logout | Déconnexion          |

### Utilisateurs
| Méthode | Route                            | Description              |
|---------|----------------------------------|--------------------------|
| GET     | /api/utilisateurs                | Liste utilisateurs       |
| POST    | /api/utilisateurs                | Créer utilisateur        |
| PUT     | /api/utilisateurs/:id            | Modifier utilisateur     |
| DELETE  | /api/utilisateurs/:id            | Supprimer utilisateur    |
| GET     | /api/utilisateurs/techniciens    | Liste techniciens        |

### Alertes publiques
| Méthode | Route                          | Description                      |
|---------|--------------------------------|----------------------------------|
| GET     | /api/alertes                   | Liste alertes actives            |
| POST    | /api/alertes                   | Créer alerte (citoyen/entreprise)|
| PATCH   | /api/alertes/:id/assign        | Assigner technicien              |
| PATCH   | /api/alertes/:id/statut        | Changer statut                   |
| DELETE  | /api/alertes/:id               | Supprimer alerte                 |
| GET     | /api/alertes/historique        | Alertes archivées (traitee/annulee)|
| GET     | /api/alertes/by-creator/:id    | Alertes créées par un utilisateur|
| GET     | /api/alertes/by-tech/:id       | Alertes assignées à un technicien|

### Alertes internes
| Méthode | Route                          | Description                              |
|---------|--------------------------------|------------------------------------------|
| GET     | /api/alertes/interne           | Toutes les alertes internes              |
| POST    | /api/alertes/interne           | Créer une alerte interne                 |
| PATCH   | /api/alertes/interne/:id       | Modifier statut / assigner technicien    |
| DELETE  | /api/alertes/interne/:id       | Supprimer une alerte interne             |

### Messages
| Méthode | Route                          | Description                      |
|---------|--------------------------------|----------------------------------|
| GET     | /api/messages                  | Conversation entre deux users    |
| POST    | /api/messages                  | Envoyer message                  |
| GET     | /api/messages/summary          | Résumé conversations             |
| POST    | /api/messages/mark-read        | Marquer messages lus             |
| PUT     | /api/messages/:id              | Modifier message                 |
| DELETE  | /api/messages/:id              | Supprimer message                |

### Stock
| Méthode | Route                          | Description                      |
|---------|--------------------------------|----------------------------------|
| GET     | /api/stock                     | Liste stock                      |
| POST    | /api/stock                     | Ajouter article                  |
| PUT     | /api/stock/:id                 | Modifier article                 |
| DELETE  | /api/stock/:id                 | Supprimer article                |

### Interventions
| Méthode | Route                          | Description                      |
|---------|--------------------------------|----------------------------------|
| GET     | /api/interventions             | Liste interventions              |
| POST    | /api/interventions             | Créer intervention               |
| PATCH   | /api/interventions/:id         | Modifier statut/priorité         |
| DELETE  | /api/interventions/:id         | Supprimer intervention           |

### Comptes rendus
| Méthode | Route                          | Description                      |
|---------|--------------------------------|----------------------------------|
| GET     | /api/compte-rendus             | Tous les rapports (admin)        |
| POST    | /api/compte-rendus             | Uploader rapport (multipart)     |
| GET     | /api/compte-rendus/mine        | Mes rapports (data)              |
| GET     | /api/compte-rendus/:id         | Détail rapport                   |
| DELETE  | /api/compte-rendus/:id         | Supprimer rapport                |

### Notifications
| Méthode | Route                               | Description                      |
|---------|-------------------------------------|----------------------------------|
| GET     | /api/notifications/latest           | Notifications récentes           |
| POST    | /api/notifications                  | Créer notification manuelle      |
| POST    | /api/notifications/mark-read        | Marquer une notif lue            |
| POST    | /api/notifications/mark-all-read    | Marquer toutes lues              |
| PATCH   | /api/notifications/:id/mark-read    | Marquer une notif lue (PATCH)    |
| DELETE  | /api/notifications/:id              | Supprimer notification           |

Documentation interactive complète : http://localhost:3000/api-docs

## Équipe

Projet ESIEA — Groupe 406

## Licence

Projet académique — ESIEA
