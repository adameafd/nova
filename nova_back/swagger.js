const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "NOVA Smart City API",
      version: "1.0.0",
      description:
        "API REST pour la plateforme NOVA de gestion de ville intelligente. Gere les alertes, interventions, messagerie, stock, comptes rendus et notifications.",
    },
    servers: [{ url: "http://localhost:3000", description: "Serveur local" }],
    tags: [
      { name: "Auth", description: "Authentification" },
      { name: "Utilisateurs", description: "Gestion des utilisateurs" },
      { name: "Alertes", description: "Alertes citoyens et entreprises" },
      { name: "Messages", description: "Messagerie directe" },
      { name: "Stock", description: "Gestion du stock" },
      { name: "Interventions", description: "Interventions techniques" },
      { name: "Comptes Rendus", description: "Rapports uploades" },
      { name: "Notifications", description: "Notifications temps reel" },
    ],
    paths: {
      // ── Auth ──
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
                    email: { type: "string", example: "admin@nova.fr" },
                    mot_de_passe: { type: "string", example: "admin123" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Connexion reussie, retourne l'utilisateur" },
            401: { description: "Identifiants invalides" },
          },
        },
      },

      // ── Utilisateurs ──
      "/api/utilisateurs": {
        get: {
          tags: ["Utilisateurs"],
          summary: "Liste tous les utilisateurs",
          responses: { 200: { description: "Tableau d'utilisateurs" } },
        },
        post: {
          tags: ["Utilisateurs"],
          summary: "Creer un utilisateur",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["nom", "email", "mot_de_passe", "role"],
                  properties: {
                    nom: { type: "string" },
                    email: { type: "string" },
                    mot_de_passe: { type: "string" },
                    role: {
                      type: "string",
                      enum: ["admin", "technicien", "data"],
                    },
                    civilite: { type: "string" },
                    photo: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Utilisateur cree" },
            400: { description: "Donnees invalides" },
          },
        },
      },
      "/api/utilisateurs/{id}": {
        put: {
          tags: ["Utilisateurs"],
          summary: "Modifier un utilisateur",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Utilisateur modifie" } },
        },
        delete: {
          tags: ["Utilisateurs"],
          summary: "Supprimer un utilisateur",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Utilisateur supprime" } },
        },
      },
      "/api/utilisateurs/techniciens": {
        get: {
          tags: ["Utilisateurs"],
          summary: "Liste des techniciens",
          responses: {
            200: {
              description: "Tableau de techniciens (id, nom, email)",
            },
          },
        },
      },

      // ── Alertes ──
      "/api/alertes": {
        get: {
          tags: ["Alertes"],
          summary: "Liste des alertes actives",
          parameters: [
            {
              name: "source_type",
              in: "query",
              schema: { type: "string", enum: ["citoyen", "entreprise"] },
            },
          ],
          responses: { 200: { description: "Tableau d'alertes" } },
        },
        post: {
          tags: ["Alertes"],
          summary: "Creer une alerte",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["source_type", "description"],
                  properties: {
                    source_type: {
                      type: "string",
                      enum: ["citoyen", "entreprise"],
                    },
                    nom_demandeur: { type: "string" },
                    email: { type: "string" },
                    type_alerte: {
                      type: "string",
                      enum: ["panne", "proposition", "autre"],
                    },
                    priorite: {
                      type: "string",
                      enum: ["basse", "moyenne", "haute"],
                    },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Alerte creee" } },
        },
      },
      "/api/alertes/{id}/assign": {
        patch: {
          tags: ["Alertes"],
          summary: "Assigner un technicien a une alerte",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    technicien_id: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Technicien assigne" } },
        },
      },
      "/api/alertes/{id}/statut": {
        patch: {
          tags: ["Alertes"],
          summary:
            "Changer le statut d'une alerte (si resolue → archive dans historique)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["statut"],
                  properties: {
                    statut: {
                      type: "string",
                      enum: ["nouveau", "en_cours", "resolue"],
                    },
                    technicien_id: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Statut mis a jour" } },
        },
      },
      "/api/alertes/{id}": {
        delete: {
          tags: ["Alertes"],
          summary: "Supprimer une alerte",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Alerte supprimee" } },
        },
      },
      "/api/alertes/historique": {
        get: {
          tags: ["Alertes"],
          summary: "Historique des alertes resolues",
          responses: { 200: { description: "Tableau d'alertes archivees" } },
        },
      },
      "/api/alertes/by-tech/{id}": {
        get: {
          tags: ["Alertes"],
          summary: "Alertes assignees a un technicien",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
              description: "ID du technicien",
            },
          ],
          responses: { 200: { description: "Alertes du technicien" } },
        },
      },

      // ── Messages ──
      "/api/messages": {
        get: {
          tags: ["Messages"],
          summary: "Messages entre deux utilisateurs",
          parameters: [
            {
              name: "user1",
              in: "query",
              required: true,
              schema: { type: "integer" },
            },
            {
              name: "user2",
              in: "query",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Conversation" } },
        },
        post: {
          tags: ["Messages"],
          summary: "Envoyer un message",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["expediteur_id", "destinataire_id", "contenu"],
                  properties: {
                    expediteur_id: { type: "integer" },
                    destinataire_id: { type: "integer" },
                    contenu: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Message envoye" } },
        },
      },
      "/api/messages/summary": {
        get: {
          tags: ["Messages"],
          summary:
            "Resume des conversations (dernier message, compteur non-lus)",
          parameters: [
            {
              name: "userId",
              in: "query",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Resume conversations" } },
        },
      },
      "/api/messages/mark-read": {
        post: {
          tags: ["Messages"],
          summary: "Marquer les messages comme lus",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["fromUserId", "toUserId"],
                  properties: {
                    fromUserId: { type: "integer" },
                    toUserId: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Messages marques comme lus" } },
        },
      },
      "/api/messages/{id}": {
        put: {
          tags: ["Messages"],
          summary: "Modifier un message",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Message modifie" } },
        },
        delete: {
          tags: ["Messages"],
          summary: "Supprimer un message",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Message supprime" } },
        },
      },

      // ── Stock ──
      "/api/stock": {
        get: {
          tags: ["Stock"],
          summary: "Liste du stock",
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
                  required: ["nom"],
                  properties: {
                    nom: { type: "string" },
                    code: { type: "string" },
                    categorie: { type: "string" },
                    quantite: { type: "integer" },
                    seuil_alerte: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Article cree" } },
        },
      },
      "/api/stock/{id}": {
        put: {
          tags: ["Stock"],
          summary: "Modifier un article",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Article modifie" } },
        },
        delete: {
          tags: ["Stock"],
          summary: "Supprimer un article",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Article supprime" } },
        },
      },
      "/api/stock/etat-critique": {
        get: {
          tags: ["Stock"],
          summary: "Articles en etat critique (quantite <= 5)",
          responses: { 200: { description: "Articles critiques" } },
        },
      },

      // ── Interventions ──
      "/api/interventions": {
        get: {
          tags: ["Interventions"],
          summary: "Liste des interventions",
          parameters: [
            {
              name: "technicien_id",
              in: "query",
              schema: { type: "integer" },
              description: "Filtrer par technicien",
            },
          ],
          responses: { 200: { description: "Tableau d'interventions" } },
        },
        post: {
          tags: ["Interventions"],
          summary: "Creer une intervention",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["titre", "description", "technicien_id"],
                  properties: {
                    titre: { type: "string" },
                    description: { type: "string" },
                    priorite: {
                      type: "string",
                      enum: ["basse", "moyenne", "haute", "critique"],
                    },
                    statut: {
                      type: "string",
                      enum: [
                        "en_attente",
                        "en_cours",
                        "resolue",
                        "annulee",
                      ],
                    },
                    unite: { type: "string" },
                    technicien_id: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Intervention creee" } },
        },
      },
      "/api/interventions/{id}": {
        patch: {
          tags: ["Interventions"],
          summary: "Modifier statut/priorite d'une intervention",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Intervention modifiee" } },
        },
        delete: {
          tags: ["Interventions"],
          summary: "Supprimer une intervention",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Intervention supprimee" } },
        },
      },

      // ── Comptes Rendus ──
      "/api/compte-rendus": {
        get: {
          tags: ["Comptes Rendus"],
          summary: "Tous les rapports (admin)",
          responses: { 200: { description: "Tableau de rapports" } },
        },
        post: {
          tags: ["Comptes Rendus"],
          summary: "Uploader un rapport",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["type", "fichier", "created_by"],
                  properties: {
                    titre: { type: "string" },
                    type: { type: "string" },
                    fichier: { type: "string", format: "binary" },
                    created_by: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Rapport cree" } },
        },
      },
      "/api/compte-rendus/mine": {
        get: {
          tags: ["Comptes Rendus"],
          summary: "Mes rapports (data)",
          parameters: [
            {
              name: "userId",
              in: "query",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Rapports de l'utilisateur" } },
        },
      },
      "/api/compte-rendus/{id}": {
        get: {
          tags: ["Comptes Rendus"],
          summary: "Detail d'un rapport",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            200: { description: "Rapport" },
            404: { description: "Introuvable" },
          },
        },
        delete: {
          tags: ["Comptes Rendus"],
          summary: "Supprimer un rapport",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { 200: { description: "Rapport supprime" } },
        },
      },

      // ── Notifications ──
      "/api/notifications/latest": {
        get: {
          tags: ["Notifications"],
          summary: "Dernieres notifications",
          parameters: [
            {
              name: "userId",
              in: "query",
              required: true,
              schema: { type: "integer" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
            },
          ],
          responses: { 200: { description: "Notifications recentes" } },
        },
      },
      "/api/notifications": {
        post: {
          tags: ["Notifications"],
          summary: "Creer une notification",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    user_id: { type: "integer", nullable: true },
                    type: { type: "string", default: "INFO" },
                    message: { type: "string" },
                    link: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Notification creee" } },
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
          responses: { 200: { description: "Notification marquee lue" } },
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
