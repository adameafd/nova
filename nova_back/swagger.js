const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "NOVA Smart City API",
      version: "2.0.0",
      description:
        "API REST pour la plateforme NOVA de gestion de ville intelligente. " +
        "Gère les alertes publiques (citoyen/entreprise), les alertes internes (employés), " +
        "les interventions, la messagerie, le stock, les comptes rendus et les notifications.",
    },
    servers: [{ url: "http://localhost:3000", description: "Serveur local" }],
    tags: [
      { name: "Auth", description: "Authentification" },
      { name: "Utilisateurs", description: "Gestion des utilisateurs" },
      { name: "Alertes", description: "Alertes publiques — citoyen et entreprise" },
      { name: "Alertes Internes", description: "Alertes internes entre employés (table alertes_internes)" },
      { name: "Messages", description: "Messagerie directe" },
      { name: "Stock", description: "Gestion du stock" },
      { name: "Interventions", description: "Interventions techniques" },
      { name: "Comptes Rendus", description: "Rapports uploadés" },
      { name: "Notifications", description: "Notifications broadcast et privées" },
    ],
    components: {
      schemas: {
        Alerte: {
          type: "object",
          properties: {
            id:               { type: "integer", example: 1 },
            source_type:      { type: "string", enum: ["citoyen", "entreprise"] },
            nom_demandeur:    { type: "string", example: "Jean Dupont" },
            nom_entreprise:   { type: "string", nullable: true },
            contact:          { type: "string", nullable: true },
            email:            { type: "string", nullable: true },
            type_alerte:      { type: "string", example: "Panne ou dysfonctionnement" },
            priorite:         { type: "string", enum: ["basse", "moyenne", "haute"] },
            description:      { type: "string" },
            statut:           { type: "string", enum: ["nouveau", "en_cours", "resolue", "traitee", "annulee"] },
            technicien_id:    { type: "integer", nullable: true },
            technicien_nom:   { type: "string", nullable: true },
            cree_par:         { type: "integer", nullable: true },
            date_creation:    { type: "string", format: "date-time" },
            date_mise_a_jour: { type: "string", format: "date-time" },
          },
        },
        AlerteInterne: {
          type: "object",
          properties: {
            id:               { type: "integer", example: 1 },
            categorie:        { type: "string", example: "Panne ascenseur bâtiment A" },
            priorite:         { type: "string", enum: ["basse", "moyenne", "haute"] },
            description:      { type: "string" },
            statut:           { type: "string", enum: ["en_cours", "traitee", "annulee"] },
            cree_par:         { type: "integer" },
            createur_nom:     { type: "string" },
            createur_role:    { type: "string", enum: ["admin", "technicien", "data"] },
            technicien_id:    { type: "integer", nullable: true },
            technicien_nom:   { type: "string", nullable: true },
            date_creation:    { type: "string", format: "date-time" },
            date_mise_a_jour: { type: "string", format: "date-time" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id:         { type: "integer" },
            user_id:    { type: "integer", nullable: true, description: "NULL = broadcast visible par tous" },
            type:       { type: "string", enum: ["INFO", "ALERTE", "ALERTE_INTERNE", "STOCK", "COMPTE_RENDU", "INTERVENTION"] },
            title:      { type: "string", nullable: true },
            message:    { type: "string" },
            link:       { type: "string", nullable: true },
            is_read:    { type: "integer", enum: [0, 1] },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    paths: {

      // ── Auth ──────────────────────────────────────────────────────────
      "/api/login": {
        post: {
          tags: ["Auth"],
          summary: "Connexion utilisateur",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "mot_de_passe"],
                  properties: {
                    email:        { type: "string", example: "admin@nova.fr" },
                    mot_de_passe: { type: "string", example: "admin123" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Connexion réussie — retourne l'objet utilisateur" },
            401: { description: "Identifiants invalides" },
          },
        },
      },

      // ── Utilisateurs ─────────────────────────────────────────────────
      "/api/utilisateurs": {
        get: {
          tags: ["Utilisateurs"],
          summary: "Liste tous les utilisateurs",
          responses: { 200: { description: "Tableau d'utilisateurs" } },
        },
        post: {
          tags: ["Utilisateurs"],
          summary: "Créer un utilisateur",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["nom", "email", "mot_de_passe", "role"],
                  properties: {
                    nom:          { type: "string" },
                    email:        { type: "string" },
                    mot_de_passe: { type: "string" },
                    role:         { type: "string", enum: ["admin", "technicien", "data", "entreprise"] },
                    civilite:     { type: "string" },
                    photo:        { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Utilisateur créé" },
            400: { description: "Données invalides" },
          },
        },
      },
      "/api/utilisateurs/{id}": {
        put: {
          tags: ["Utilisateurs"],
          summary: "Modifier un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Utilisateur modifié" } },
        },
        delete: {
          tags: ["Utilisateurs"],
          summary: "Supprimer un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Utilisateur supprimé" } },
        },
      },
      "/api/utilisateurs/techniciens": {
        get: {
          tags: ["Utilisateurs"],
          summary: "Liste des techniciens",
          responses: { 200: { description: "Tableau de techniciens (id, nom, email)" } },
        },
      },

      // ── Alertes publiques ─────────────────────────────────────────────
      "/api/alertes": {
        get: {
          tags: ["Alertes"],
          summary: "Liste des alertes actives",
          description: "Retourne les alertes dont le statut n'est PAS traitee/annulee. Filtrable par source_type, statut, type_alerte, priorite.",
          parameters: [
            { name: "source_type", in: "query", schema: { type: "string", enum: ["citoyen", "entreprise"] } },
            { name: "statut",      in: "query", schema: { type: "string", enum: ["nouveau", "en_cours", "resolue", "traitee", "annulee"] } },
            { name: "type_alerte", in: "query", schema: { type: "string" } },
            { name: "priorite",    in: "query", schema: { type: "string", enum: ["basse", "moyenne", "haute"] } },
          ],
          responses: {
            200: {
              description: "Tableau d'alertes actives",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Alerte" } },
                },
              },
            },
          },
        },
        post: {
          tags: ["Alertes"],
          summary: "Créer une alerte publique",
          description: "Accessible depuis le formulaire public (citoyen/entreprise) et depuis le back-office (cree_par = userId). La priorité est calculée automatiquement depuis type_alerte.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["source_type", "nom_demandeur", "type_alerte", "description"],
                  properties: {
                    source_type:   { type: "string", enum: ["citoyen", "entreprise"] },
                    nom_demandeur: { type: "string", example: "Jean Dupont" },
                    nom_entreprise:{ type: "string", nullable: true },
                    contact:       { type: "string", nullable: true },
                    email:         { type: "string", nullable: true },
                    type_alerte:   {
                      type: "string",
                      enum: ["panne", "proposition", "autre", "Panne ou dysfonctionnement", "Proposition d'amélioration", "Autre"],
                      description: "Accepte codes courts ou labels complets. Priorité calculée automatiquement.",
                    },
                    description:   { type: "string" },
                    cree_par:      { type: "integer", nullable: true, description: "ID utilisateur back-office (optionnel pour le public)" },
                  },
                },
                example: {
                  source_type: "citoyen",
                  nom_demandeur: "Jean Dupont",
                  type_alerte: "panne",
                  description: "La borne de recharge électrique rue Pasteur est hors service.",
                },
              },
            },
          },
          responses: {
            201: {
              description: "Alerte créée + notification broadcast déclenchée",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Alerte" } } },
            },
            400: { description: "Champs obligatoires manquants ou type_alerte invalide" },
          },
        },
      },
      "/api/alertes/historique": {
        get: {
          tags: ["Alertes"],
          summary: "Historique des alertes archivées",
          description: "Retourne les alertes avec statut 'traitee' ou 'annulee', ordonnées par date de mise à jour.",
          responses: {
            200: {
              description: "Tableau d'alertes archivées",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Alerte" } } } },
            },
          },
        },
      },
      "/api/alertes/by-creator/{id}": {
        get: {
          tags: ["Alertes"],
          summary: "Alertes créées par un utilisateur",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, description: "ID du créateur" }],
          responses: { 200: { description: "Alertes créées par cet utilisateur" } },
        },
      },
      "/api/alertes/by-tech/{id}": {
        get: {
          tags: ["Alertes"],
          summary: "Alertes assignées à un technicien",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, description: "ID du technicien" }],
          responses: { 200: { description: "Alertes du technicien" } },
        },
      },
      "/api/alertes/{id}/assign": {
        patch: {
          tags: ["Alertes"],
          summary: "Assigner un technicien à une alerte",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { technicien_id: { type: "integer", nullable: true } },
                },
                example: { technicien_id: 3 },
              },
            },
          },
          responses: { 200: { description: "Technicien assigné" } },
        },
      },
      "/api/alertes/{id}/statut": {
        patch: {
          tags: ["Alertes"],
          summary: "Changer le statut d'une alerte",
          description: "Admin peut changer le statut de toutes les alertes. Tech peut changer celles qui lui sont assignées.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["statut"],
                  properties: {
                    statut:        { type: "string", enum: ["nouveau", "en_cours", "resolue", "traitee", "annulee"] },
                    technicien_id: { type: "integer", nullable: true },
                  },
                },
                example: { statut: "traitee", technicien_id: 3 },
              },
            },
          },
          responses: {
            200: { description: "Statut mis à jour — retourne l'alerte mise à jour" },
            404: { description: "Alerte introuvable" },
          },
        },
      },
      "/api/alertes/{id}": {
        delete: {
          tags: ["Alertes"],
          summary: "Supprimer une alerte",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Alerte supprimée" } },
        },
      },

      // ── Alertes Internes ──────────────────────────────────────────────
      "/api/alertes/interne": {
        get: {
          tags: ["Alertes Internes"],
          summary: "Toutes les alertes internes",
          description: "Retourne l'intégralité des alertes internes. Visible par admin, technicien et data. Inclut createur_nom, createur_role, technicien_nom.",
          responses: {
            200: {
              description: "Tableau d'alertes internes",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/AlerteInterne" } },
                  example: [
                    {
                      id: 1,
                      categorie: "Panne ascenseur bâtiment A",
                      priorite: "haute",
                      description: "L'ascenseur du bâtiment A est bloqué au 3e étage depuis 9h.",
                      statut: "en_cours",
                      cree_par: 2,
                      createur_nom: "Marie Lambert",
                      createur_role: "technicien",
                      technicien_id: null,
                      technicien_nom: null,
                      date_creation: "2026-02-24T09:00:00.000Z",
                      date_mise_a_jour: "2026-02-24T09:00:00.000Z",
                    },
                  ],
                },
              },
            },
          },
        },
        post: {
          tags: ["Alertes Internes"],
          summary: "Créer une alerte interne",
          description: "Accessible par admin, technicien et data. Déclenche une notification broadcast visible par tous les rôles.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["categorie", "description", "cree_par"],
                  properties: {
                    categorie:   { type: "string", example: "Panne ascenseur bâtiment A" },
                    priorite:    { type: "string", enum: ["basse", "moyenne", "haute"], default: "basse" },
                    description: { type: "string" },
                    cree_par:    { type: "integer", description: "ID de l'utilisateur connecté" },
                  },
                },
                example: {
                  categorie: "Panne ascenseur bâtiment A",
                  priorite: "haute",
                  description: "L'ascenseur du bâtiment A est bloqué au 3e étage depuis 9h.",
                  cree_par: 2,
                },
              },
            },
          },
          responses: {
            201: {
              description: "Alerte interne créée + notification broadcast déclenchée",
              content: { "application/json": { schema: { $ref: "#/components/schemas/AlerteInterne" } } },
            },
            400: { description: "Champs obligatoires manquants (categorie, description, cree_par)" },
          },
        },
      },
      "/api/alertes/interne/{id}": {
        patch: {
          tags: ["Alertes Internes"],
          summary: "Modifier le statut ou assigner un technicien",
          description: "Admin : peut modifier toutes. Technicien / Data : uniquement les leurs (cree_par = user.id). Cette règle est gérée côté frontend.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statut:        { type: "string", enum: ["en_cours", "traitee", "annulee"] },
                    technicien_id: { type: "integer", nullable: true },
                  },
                },
                example: { statut: "traitee" },
              },
            },
          },
          responses: {
            200: { description: "Alerte interne mise à jour — retourne l'objet mis à jour" },
            400: { description: "Aucun champ à modifier" },
          },
        },
        delete: {
          tags: ["Alertes Internes"],
          summary: "Supprimer une alerte interne",
          description: "Admin : peut supprimer toutes. Technicien / Data : uniquement les leurs. Cette règle est gérée côté frontend.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Alerte interne supprimée" } },
        },
      },

      // ── Messages ─────────────────────────────────────────────────────
      "/api/messages": {
        get: {
          tags: ["Messages"],
          summary: "Messages entre deux utilisateurs",
          parameters: [
            { name: "user1", in: "query", required: true, schema: { type: "integer" } },
            { name: "user2", in: "query", required: true, schema: { type: "integer" } },
          ],
          responses: { 200: { description: "Conversation ordonnée par date_envoi ASC" } },
        },
        post: {
          tags: ["Messages"],
          summary: "Envoyer un message",
          description: "Crée le message et envoie une notification privée au destinataire.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["expediteur_id", "destinataire_id", "contenu"],
                  properties: {
                    expediteur_id:   { type: "integer" },
                    destinataire_id: { type: "integer" },
                    contenu:         { type: "string" },
                  },
                },
                example: { expediteur_id: 1, destinataire_id: 3, contenu: "Bonjour, peux-tu vérifier la borne C12 ?" },
              },
            },
          },
          responses: { 201: { description: "Message envoyé + notification privée créée" } },
        },
      },
      "/api/messages/summary": {
        get: {
          tags: ["Messages"],
          summary: "Résumé des conversations (dernier message, compteur non-lus)",
          parameters: [{ name: "userId", in: "query", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Résumé conversations" } },
        },
      },
      "/api/messages/mark-read": {
        post: {
          tags: ["Messages"],
          summary: "Marquer les messages d'une conversation comme lus",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["fromUserId", "toUserId"],
                  properties: {
                    fromUserId: { type: "integer" },
                    toUserId:   { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Messages marqués comme lus" } },
        },
      },
      "/api/messages/{id}": {
        put: {
          tags: ["Messages"],
          summary: "Modifier un message",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["contenu", "expediteur_id"],
                  properties: {
                    contenu:       { type: "string" },
                    expediteur_id: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Message modifié" },
            403: { description: "Message introuvable ou non autorisé" },
          },
        },
        delete: {
          tags: ["Messages"],
          summary: "Supprimer un message",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
            { name: "expediteur_id", in: "query", required: true, schema: { type: "integer" } },
          ],
          responses: {
            200: { description: "Message supprimé" },
            403: { description: "Message introuvable ou non autorisé" },
          },
        },
      },

      // ── Stock ─────────────────────────────────────────────────────────
      "/api/stock": {
        get: {
          tags: ["Stock"],
          summary: "Liste du stock (ordonnée par nom)",
          responses: { 200: { description: "Tableau stock" } },
        },
        post: {
          tags: ["Stock"],
          summary: "Ajouter un article au stock",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nom", "categorie", "quantite"],
                  properties: {
                    nom:      { type: "string" },
                    categorie:{ type: "string" },
                    quantite: { type: "integer" },
                  },
                },
                example: { nom: "Câble RJ45 Cat6", categorie: "Réseau", quantite: 50 },
              },
            },
          },
          responses: { 201: { description: "Article créé (code généré automatiquement)" } },
        },
      },
      "/api/stock/{id}": {
        put: {
          tags: ["Stock"],
          summary: "Modifier un article",
          description: "Si quantite <= seuil_alerte après la mise à jour, une notification STOCK broadcast est créée (anti-doublon).",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nom:          { type: "string" },
                    categorie:    { type: "string" },
                    quantite:     { type: "integer" },
                    seuil_alerte: { type: "integer" },
                    total_utilise:{ type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Article modifié" } },
        },
        delete: {
          tags: ["Stock"],
          summary: "Supprimer un article",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Article supprimé" } },
        },
      },

      // ── Interventions ────────────────────────────────────────────────
      "/api/interventions": {
        get: {
          tags: ["Interventions"],
          summary: "Liste des interventions",
          parameters: [
            { name: "technicien_id", in: "query", schema: { type: "integer" }, description: "Filtrer par technicien" },
          ],
          responses: { 200: { description: "Tableau d'interventions" } },
        },
        post: {
          tags: ["Interventions"],
          summary: "Créer une intervention",
          description: "Déclenche deux notifications : broadcast (type=INTERVENTION) + privée pour le technicien assigné.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["titre", "description", "technicien_id"],
                  properties: {
                    titre:         { type: "string" },
                    description:   { type: "string" },
                    priorite:      { type: "string", enum: ["basse", "moyenne", "haute", "critique"] },
                    statut:        { type: "string", enum: ["en_attente", "en_cours", "resolue", "annulee"] },
                    unite:         { type: "string", nullable: true },
                    technicien_id: { type: "integer" },
                  },
                },
                example: {
                  titre: "Remplacement capteur CO2 — Salle B12",
                  description: "Le capteur CO2 de la salle B12 renvoie des valeurs aberrantes.",
                  priorite: "haute",
                  technicien_id: 3,
                },
              },
            },
          },
          responses: {
            201: { description: "Intervention créée + notifications déclenchées" },
            400: { description: "Champs obligatoires manquants" },
          },
        },
      },
      "/api/interventions/{id}": {
        patch: {
          tags: ["Interventions"],
          summary: "Modifier statut et/ou priorité d'une intervention",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statut:   { type: "string", enum: ["en_attente", "en_cours", "resolue", "annulee"] },
                    priorite: { type: "string", enum: ["basse", "moyenne", "haute", "critique"] },
                  },
                },
                example: { statut: "resolue" },
              },
            },
          },
          responses: { 200: { description: "Intervention modifiée" } },
        },
        delete: {
          tags: ["Interventions"],
          summary: "Supprimer une intervention",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Intervention supprimée" } },
        },
      },

      // ── Comptes Rendus ────────────────────────────────────────────────
      "/api/compte-rendus": {
        get: {
          tags: ["Comptes Rendus"],
          summary: "Tous les rapports (admin)",
          parameters: [
            { name: "role", in: "query", schema: { type: "string", enum: ["tech", "data"] }, description: "Filtrer par rôle de l'auteur" },
          ],
          responses: { 200: { description: "Tableau de rapports avec auteur_nom et auteur_email" } },
        },
        post: {
          tags: ["Comptes Rendus"],
          summary: "Uploader un rapport",
          description: "Fichier stocké dans /uploads. Déclenche une notification COMPTE_RENDU broadcast.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["type", "fichier", "created_by"],
                  properties: {
                    titre:      { type: "string" },
                    type:       { type: "string", example: "Rapport mensuel" },
                    fichier:    { type: "string", format: "binary", description: "Max 50 Mo" },
                    created_by: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Rapport créé + notification broadcast déclenchée" },
            400: { description: "Fichier manquant, type manquant, ou fichier trop volumineux" },
          },
        },
      },
      "/api/compte-rendus/mine": {
        get: {
          tags: ["Comptes Rendus"],
          summary: "Mes rapports (data)",
          parameters: [{ name: "userId", in: "query", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Rapports de l'utilisateur" } },
        },
      },
      "/api/compte-rendus/{id}": {
        get: {
          tags: ["Comptes Rendus"],
          summary: "Détail d'un rapport",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Rapport + auteur_nom" },
            404: { description: "Introuvable" },
          },
        },
        delete: {
          tags: ["Comptes Rendus"],
          summary: "Supprimer un rapport (fichier physique inclus)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Rapport et fichier supprimés" } },
        },
      },

      // ── Notifications ─────────────────────────────────────────────────
      "/api/notifications/latest": {
        get: {
          tags: ["Notifications"],
          summary: "Dernières notifications de l'utilisateur",
          description: "Retourne les notifications privées (user_id = userId) ET broadcast (user_id IS NULL). Ordonnées par date DESC.",
          parameters: [
            { name: "userId", in: "query", required: true, schema: { type: "integer" } },
            { name: "limit",  in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: {
              description: "Tableau de notifications",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Notification" } } } },
            },
            400: { description: "userId manquant" },
          },
        },
      },
      "/api/notifications": {
        post: {
          tags: ["Notifications"],
          summary: "Créer une notification (manuelle)",
          description: "user_id = null → broadcast visible par tous. user_id = N → notification privée.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    user_id: { type: "integer", nullable: true },
                    type:    { type: "string", default: "INFO" },
                    title:   { type: "string", nullable: true },
                    message: { type: "string" },
                    link:    { type: "string", nullable: true },
                  },
                },
                example: {
                  user_id: null,
                  type: "INFO",
                  title: "Maintenance prévue",
                  message: "Le serveur sera indisponible le 28/02 de 2h à 4h.",
                  link: null,
                },
              },
            },
          },
          responses: { 201: { description: "Notification créée" } },
        },
      },
      "/api/notifications/mark-read": {
        post: {
          tags: ["Notifications"],
          summary: "Marquer une notification comme lue",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["notificationId"],
                  properties: { notificationId: { type: "integer" } },
                },
              },
            },
          },
          responses: { 200: { description: "Notification marquée lue" } },
        },
      },
      "/api/notifications/mark-all-read": {
        post: {
          tags: ["Notifications"],
          summary: "Marquer toutes les notifications comme lues",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { userId: { type: "integer" } },
                },
              },
            },
          },
          responses: { 200: { description: "Toutes les notifications marquées lues" } },
        },
      },
      "/api/notifications/{id}/mark-read": {
        patch: {
          tags: ["Notifications"],
          summary: "Marquer une notification comme lue (PATCH)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Notification marquée lue" } },
        },
      },
      "/api/notifications/{id}": {
        delete: {
          tags: ["Notifications"],
          summary: "Supprimer une notification",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Notification supprimée" } },
        },
      },
    },
  },
  apis: [],
};

const specs = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "NOVA API Documentation",
  }));
}

module.exports = { setupSwagger, specs };
