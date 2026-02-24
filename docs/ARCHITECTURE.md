# Architecture NOVA Smart City

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19 + Vite 7)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  Admin   │  │  Tech    │  │  Data    │  │  Public          │    │
│  │ 10 pages │  │  7 pages │  │  5 pages │  │  Home/About/     │    │
│  │ +IoT DB  │  │          │  │          │  │  Contact/Login   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       └─────────────┴─────────────┴─────────────────┘             │
│                          │ HTTP / WebSocket                         │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express 5)                      │
│                                                                      │
│  ┌──────────┐  ┌────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │ REST API │  │ Socket.io  │  │  Middlewares   │  │   Multer    │  │
│  │          │  │ (real-time)│  │ CORS / errors  │  │  (uploads)  │  │
│  │          │  │            │  │ apiKeyAuth     │  │             │  │
│  └────┬─────┘  └─────┬──────┘  └────────────────┘  └─────────────┘  │
│       │              │                                               │
│       └──────┬────────┘                                              │
│              │                                                       │
│    ┌─────────▼─────────┐                                            │
│    │  utils/notif.js   │  Utilitaire centralisé de notifications    │
│    │  createNotif()    │  user_id=null → broadcast (tous les rôles) │
│    └─────────┬─────────┘                                            │
└──────────────┼───────────────────────────────────────────────────────┘
               │ SQL
    ┌──────────┴────────────────┐
    │                           │
    ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│   MySQL 8 — nova (BDD)   │  │   MySQL 8 — nova_telemetry (BDD) │
│                          │  │                                  │
│  - utilisateurs          │  │  - devices                       │
│  - alertes               │  │  - mesures                       │
│  - alertes_historique    │  │  - supercap                      │
│  - alertes_internes      │  │  - batterie                      │
│  - messages              │  │  - systeme                       │
│  - stock                 │  │                                  │
│  - interventions         │  │   ▲                              │
│  - comptes_rendus        │  │   │ POST /api/telemetry          │
│  - notifications         │  │   │ (x-api-key)                  │
│  - releves_capteurs      │  │                                  │
└──────────────────────────┘  └──────┬───────────────────────────┘
                                     │
                              ┌──────┴──────┐
                              │  ESP32      │
                              │  IoT Node   │
                              └─────────────┘
```

## Flux de données

### 1. Alertes publiques (citoyen / entreprise)
```
Formulaire public → POST /api/alertes → table alertes
                                      → notification broadcast (type=ALERTE)
Admin assigne technicien → PATCH /api/alertes/:id/assign
Technicien/Admin résout  → PATCH /api/alertes/:id/statut (traitee|annulee)
                         → alerte reste dans alertes, visible via GET /historique
```

### 2. Alertes internes (entre employés)
```
Admin/Tech/Data crée    → POST /api/alertes/interne → table alertes_internes
                                                     → notification broadcast (type=ALERTE_INTERNE)
Admin change statut     → PATCH /api/alertes/interne/:id (sur toutes)
Tech/Data change statut → PATCH /api/alertes/interne/:id (uniquement les leurs)
```

### 3. Messagerie temps réel
```
User envoie message → POST /api/messages
                    → Socket.io emit "message:send"
                    → notification privée pour le destinataire (type=INFO)
                    → badge non-lu mis à jour (polling /summary)
```

### 4. Télémétrie IoT — ESP32 (implémenté)
```
ESP32 collecte données  → POST /api/telemetry (header: x-api-key)
                        → middleware apiKeyAuth valide la clé
                        → validation du payload JSON
                        → transaction SQL :
                            INSERT devices (upsert)
                            INSERT mesures   (parent)
                            INSERT supercap  (tension_V, energie_J)
                            INSERT batterie  (tension_V, courant_A, etat)
                            INSERT systeme   (led_on, status)
                        → Socket.io emit "telemetry_update" (payload normalisé)
                        → Dashboard IoT admin mis à jour en temps réel

Frontend polling/socket → GET /api/telemetry/latest?deviceId=...
                        → GET /api/telemetry/history?deviceId=...&range=10m|1h|24h|7d
                        → GET /api/telemetry/devices
```

### 5. Gestion de stock
```
Admin CRUD stock → API REST /api/stock
                 → si quantite <= seuil_alerte : createNotif broadcast (type=STOCK)
                 → anti-doublon : pas de nouvelle notif si une STOCK non-lue existe
```

### 6. Comptes rendus
```
Data upload fichier → POST /api/compte-rendus (multipart)
                    → fichier stocké dans /uploads
                    → notification broadcast (type=COMPTE_RENDU)
Admin consulte/supprime → GET/DELETE /api/compte-rendus
```

### 7. Interventions
```
Admin crée intervention → POST /api/interventions
                        → notification broadcast (type=INTERVENTION)
                        → notification privée pour le technicien assigné
Technicien met à jour   → PATCH /api/interventions/:id
```

### 8. Notifications (utils/notif.js)
```
createNotif({ user_id: null, ... })    → INSERT user_id=NULL → visible par TOUS
createNotif({ user_id: 42, ... })      → INSERT user_id=42   → visible par user 42 seulement

Frontend query : WHERE user_id = {userId} OR user_id IS NULL
Polling toutes les 15s depuis les pages Accueil de chaque rôle
```

## Rôles et permissions

| Page                 | Admin | Technicien | Data |
|----------------------|-------|------------|------|
| Accueil / Dashboard  |   x   |     x      |  x   |
| Alertes (publiques)  |   x   |     x      |      |
| Alertes internes     |   x   |     x      |  x   |
| Interventions        |   x   |     x      |      |
| Messagerie           |   x   |     x      |  x   |
| Stock                |   x   |     x      |      |
| Utilisateurs         |   x   |            |      |
| Unité de contrôle    |   x   |     x      |      |
| Comptes rendus       |   x   |            |  x   |
| Notifications        |   x   |     x      |  x   |
| Dashboard IoT        |   x   |            |      |

### Règles fines — Alertes internes

| Action                        | Admin | Technicien | Data |
|-------------------------------|-------|------------|------|
| Voir toutes les alertes       |   x   |     x      |  x   |
| Créer une alerte              |   x   |     x      |  x   |
| Modifier statut (toutes)      |   x   |            |      |
| Modifier statut (les siennes) |       |     x      |  x   |
| Supprimer (toutes)            |   x   |            |      |
| Supprimer (les siennes)       |       |     x      |  x   |

## Stack technique

| Couche    | Technologie              | Version |
|-----------|--------------------------|---------|
| Frontend  | React + Vite             | 19 / 7  |
| Routing   | React Router DOM         | 7       |
| Charts    | Chart.js                 | 4       |
| Real-time | Socket.io-client         | 4       |
| Backend   | Express.js               | 5       |
| BDD       | MySQL                    | 8       |
| ORM       | mysql2/promise (raw SQL) | 3       |
| Upload    | Multer                   | 2       |
| Real-time | Socket.io                | 4       |
| Container | Docker + Compose         | -       |
| API Docs  | Swagger / OpenAPI 3.0    | -       |
