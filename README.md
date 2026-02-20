# NOVA - Smart City Management Platform

Plateforme de gestion de ville intelligente permettant le suivi des alertes citoyennes, la gestion des interventions techniques, la messagerie interne et le monitoring IoT.

## Stack technique

| Couche     | Technologie                  |
|------------|------------------------------|
| Frontend   | React 19 + Vite 7            |
| Backend    | Node.js + Express 5          |
| Base de donnees | MySQL 8                 |
| Temps reel | Socket.io                    |
| Upload     | Multer                       |
| Graphiques | Chart.js                     |
| Container  | Docker + Docker Compose      |
| Tests      | Vitest + Testing Library      |
| API Docs   | Swagger / OpenAPI 3.0        |

## Architecture

```
┌──────────────────┐     HTTP / WS     ┌──────────────────┐     SQL     ┌─────────┐
│   React SPA      │ ◄──────────────► │   Express API    │ ◄────────► │  MySQL  │
│   (port 80)      │                   │   (port 3000)    │            │  (3306) │
└──────────────────┘                   └──────────────────┘            └─────────┘
                                              ▲
                                              │ MQTT (prevu)
                                       ┌──────┴──────┐
                                       │  Capteurs   │
                                       │  IoT        │
                                       └─────────────┘
```

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le detail complet.
Voir [docs/DATABASE.md](docs/DATABASE.md) pour le schema de base de donnees.

## Fonctionnalites

### Administration (role: admin)
- **Dashboard** : graphiques temps reel (alertes, stock critique, interventions)
- **Alertes** : reception, tri par priorite, assignation aux techniciens, archivage historique
- **Interventions** : creation, suivi, changement de statut/priorite
- **Messagerie** : messagerie directe temps reel avec badges non-lus
- **Stock** : CRUD inventaire, seuil d'alerte automatique
- **Utilisateurs** : gestion des comptes (CRUD + photo de profil)
- **Comptes rendus** : consultation et suppression des rapports uploades
- **Unite de controle** : monitoring des capteurs et unites

### Technicien (role: technicien)
- Alertes assignees avec changement de statut
- Interventions assignees
- Messagerie interne
- Gestion du stock

### Equipe Data (role: data)
- Dashboard analytique
- Upload de comptes rendus (PDF, Excel, images)
- Messagerie interne

### Public
- Page d'accueil, A propos, Contact
- Formulaire de connexion

## Installation locale

### Prerequis
- Node.js >= 18
- MySQL 8
- npm

### 1. Base de donnees
```bash
mysql -u root -p < nova_back/sql/init.sql
```

### 2. Backend
```bash
cd nova_back
cp .env.example .env    # Configurer les variables
npm install
npm run dev             # Demarre sur http://localhost:3000
```

### 3. Frontend
```bash
cd nova-react
npm install
npm run dev             # Demarre sur http://localhost:5173
```

### 4. Documentation API
Demarrer le backend puis ouvrir : http://localhost:3000/api-docs

## Installation Docker

```bash
docker-compose up --build
```

Services :
- Frontend : http://localhost
- Backend API : http://localhost:3000
- API Docs : http://localhost:3000/api-docs
- MySQL : localhost:3306

## Tests

```bash
cd nova-react
npm test            # Mode watch
npm run test:run    # Execution unique (CI)
```

## Structure du projet

```
Nova---406-main/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   └── DATABASE.md
├── nova_back/                  # API Backend
│   ├── Dockerfile
│   ├── .env.example
│   ├── server.js               # Point d'entree + Socket.io
│   ├── app.js                  # Express app + routes
│   ├── swagger.js              # Documentation OpenAPI
│   ├── config/
│   │   └── db.js               # Pool MySQL + migrations
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── utilisateurs.controller.js
│   │   ├── alertes.controller.js
│   │   └── stock.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── utilisateurs.routes.js
│   │   ├── alertes.routes.js
│   │   ├── messages.routes.js
│   │   ├── stock.routes.js
│   │   ├── interventions.routes.js
│   │   ├── comptesRendus.routes.js
│   │   └── notifications.routes.js
│   ├── middlewares/
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── sql/
│   │   └── init.sql            # Schema complet
│   └── uploads/                # Fichiers uploades
├── nova-react/                 # Frontend React
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx             # Routing principal
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── components/         # Composants reutilisables
│   │   │   ├── Layout.jsx
│   │   │   ├── PublicLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopBar.jsx
│   │   │   ├── ProfileModal.jsx
│   │   │   ├── ConfirmModal.jsx
│   │   │   └── NotificationsDropdown.jsx
│   │   ├── pages/
│   │   │   ├── admin/          # 9 pages
│   │   │   ├── tech/           # 6 pages
│   │   │   ├── data/           # 4 pages
│   │   │   └── public/         # 4 pages
│   │   ├── utils/
│   │   │   └── helpers.js      # Fonctions utilitaires
│   │   ├── css/                # Styles par module
│   │   ├── assets/             # Images
│   │   └── test/               # Tests unitaires
│   │       ├── setup.js
│   │       ├── helpers.test.js
│   │       └── ConfirmModal.test.jsx
│   └── public/
└── .gitignore
```

## API Endpoints

| Methode | Route                          | Description                    |
|---------|--------------------------------|--------------------------------|
| POST    | /api/login                     | Authentification               |
| GET     | /api/utilisateurs              | Liste utilisateurs             |
| POST    | /api/utilisateurs              | Creer utilisateur              |
| PUT     | /api/utilisateurs/:id          | Modifier utilisateur           |
| DELETE  | /api/utilisateurs/:id          | Supprimer utilisateur          |
| GET     | /api/alertes                   | Liste alertes actives          |
| POST    | /api/alertes                   | Creer alerte                   |
| PATCH   | /api/alertes/:id/assign        | Assigner technicien            |
| PATCH   | /api/alertes/:id/statut        | Changer statut                 |
| DELETE  | /api/alertes/:id               | Supprimer alerte               |
| GET     | /api/alertes/historique        | Alertes archivees              |
| GET     | /api/messages?user1=X&user2=Y  | Conversation                   |
| POST    | /api/messages                  | Envoyer message                |
| GET     | /api/messages/summary          | Resume conversations           |
| POST    | /api/messages/mark-read        | Marquer lus                    |
| GET     | /api/stock                     | Liste stock                    |
| POST    | /api/stock                     | Ajouter article                |
| GET     | /api/interventions             | Liste interventions            |
| POST    | /api/interventions             | Creer intervention             |
| GET     | /api/compte-rendus             | Liste rapports                 |
| POST    | /api/compte-rendus             | Uploader rapport               |
| GET     | /api/notifications/latest      | Notifications recentes         |

Documentation interactive complete : http://localhost:3000/api-docs

## Equipe

Projet ESIEA - Groupe 406

## Licence

Projet academique - ESIEA
