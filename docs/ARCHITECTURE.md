# Architecture NOVA Smart City

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │  Admin    │  │  Tech    │  │  Data    │  │  Public       │   │
│  │  9 pages  │  │  6 pages │  │  4 pages │  │  Home/About/  │   │
│  │          │  │          │  │          │  │  Contact/Login│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘   │
│       └──────────────┴─────────────┴────────────────┘           │
│                           │ HTTP / WebSocket                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express 5)                 │
│                                                                   │
│  ┌─────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │  REST   │  │  Socket.io   │  │ Middlewares │  │  Multer    │  │
│  │  API    │  │  (real-time) │  │ (CORS,err) │  │  (uploads) │  │
│  └────┬────┘  └──────┬───────┘  └────────────┘  └────────────┘  │
│       │              │                                            │
│       └──────┬───────┘                                            │
│              │                                                    │
└──────────────┼────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────┐     ┌──────────────────────────────────┐
│   MySQL 8 (BDD)      │     │   MQTT Broker (Mosquitto)        │
│                      │     │   (IoT sensor data ingestion)    │
│  - utilisateurs      │     │                                  │
│  - alertes           │◄────│   Capteurs → MQTT → Backend      │
│  - alertes_historique│     │   → releves_capteurs (BDD)       │
│  - messages          │     │                                  │
│  - stock             │     └──────────────────────────────────┘
│  - interventions     │
│  - comptes_rendus    │
│  - notifications     │
│  - releves_capteurs  │
└──────────────────────┘
```

## Flux de données

### 1. Alertes citoyens / entreprises
```
Formulaire public → POST /api/alertes → table alertes
                                        → notification temps réel (Socket.io)
Admin assigne technicien → PATCH /api/alertes/:id/assign
Technicien résout        → PATCH /api/alertes/:id/statut
                           → déplace vers alertes_historique
```

### 2. Messagerie temps réel
```
User envoie message → POST /api/messages
                    → Socket.io emit "message:send"
                    → destinataire reçoit en temps réel
                    → badge non-lu mis à jour (polling /summary)
```

### 3. Capteurs IoT (architecture prévue)
```
Capteur physique → MQTT publish (topic: nova/sensors/{id})
                 → Backend subscribe MQTT
                 → INSERT INTO releves_capteurs
                 → Dashboard affiche graphiques temps réel
```

### 4. Gestion de stock
```
Admin CRUD stock → API REST /api/stock
                 → seuil_alerte déclenche notification
                 → Dashboard affiche état critique
```

### 5. Comptes rendus
```
Data upload fichier → POST /api/compte-rendus (multipart)
                    → fichier stocké dans /uploads
                    → notification automatique créée
Admin consulte/supprime → GET/DELETE /api/compte-rendus
```

## Rôles et permissions

| Page              | Admin | Technicien | Data |
|-------------------|-------|------------|------|
| Accueil           |   x   |     x      |  x   |
| Dashboard         |   x   |            |  x   |
| Alertes           |   x   |     x      |      |
| Interventions     |   x   |     x      |      |
| Messagerie        |   x   |     x      |  x   |
| Stock             |   x   |     x      |      |
| Utilisateurs      |   x   |            |      |
| Unité de contrôle |   x   |     x      |      |
| Comptes rendus    |   x   |            |  x   |

## Stack technique

| Couche    | Technologie           | Version |
|-----------|-----------------------|---------|
| Frontend  | React + Vite          | 19 / 7  |
| Routing   | React Router          | 7       |
| Charts    | Chart.js              | 4       |
| Real-time | Socket.io-client      | 4       |
| Backend   | Express.js            | 5       |
| BDD       | MySQL                 | 8       |
| ORM       | mysql2/promise (raw)  | 3       |
| Upload    | Multer                | 2       |
| Real-time | Socket.io             | 4       |
| Container | Docker + Compose      | -       |
