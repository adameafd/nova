const db = require("../config/db");
const { createNotif } = require("../utils/notif");

// ── Normalisation des types d'alerte ────────────────────────────────
// Accepte codes courts ET labels complets — normalise vers les labels complets (valeurs DB)
const TYPE_NORMALIZE = {
  // Codes courts → labels complets
  panne:       "Panne ou dysfonctionnement",
  proposition: "Proposition d'amélioration",
  autre:       "Autre",
  // Labels complets → eux-mêmes (idempotent)
  "Panne ou dysfonctionnement": "Panne ou dysfonctionnement",
  "Proposition d'amélioration": "Proposition d'amélioration",
  "Autre":                      "Autre",
};

// ── Priorité automatique depuis le type (non modifiable) ─────────────
// "Panne ou dysfonctionnement" → haute | "Proposition d'amélioration" → moyenne | "Autre" → basse
function getPrioriteFromType(type) {
  if (type === "Panne ou dysfonctionnement") return "haute";
  if (type === "Proposition d'amélioration") return "moyenne";
  return "basse"; // Autre → Faible
}

// ── Labels pour les notifications ────────────────────────────────────
// type_alerte est déjà le label complet — on l'utilise directement
const TYPE_LABELS = {
  "Panne ou dysfonctionnement": "Panne ou dysfonctionnement",
  "Proposition d'amélioration": "Proposition d'amélioration",
  "Autre":                      "Autre",
};

// ── GET /api/alertes ─────────────────────────────────────────────────
exports.getAlertes = async (req, res, next) => {
  try {
    const { source_type, statut, type_alerte, sujet, priorite } = req.query;

    let sql = `
      SELECT
        a.id,
        a.source_type,
        a.nom_demandeur,
        a.nom_entreprise,
        a.contact,
        a.email,
        a.unite_id,
        a.capteur_id,
        a.type_alerte,
        a.priorite,
        a.description,
        a.statut,
        a.technicien_id,
        a.traite_par,
        a.date_creation,
        a.date_mise_a_jour,
        u.nom AS technicien_nom
      FROM alertes a
      LEFT JOIN utilisateurs u ON u.id = a.technicien_id
      WHERE 1=1
    `;
    const params = [];

    if (source_type) {
      sql += " AND a.source_type = ?";
      params.push(source_type);
    }

    if (statut) {
      sql += " AND a.statut = ?";
      params.push(statut);
    }

    const typeFilter = type_alerte || sujet;
    if (typeFilter) {
      // Normaliser le filtre type si nécessaire
      sql += " AND a.type_alerte = ?";
      params.push(TYPE_NORMALIZE[typeFilter] || typeFilter);
    }

    if (priorite) {
      sql += " AND a.priorite = ?";
      params.push(priorite);
    }

    sql += " ORDER BY a.date_creation DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/alertes ────────────────────────────────────────────────
exports.createAlerte = async (req, res, next) => {
  try {
    let {
      source_type,
      nom_demandeur,
      type_alerte,
      description,
      nom_entreprise,
      contact,
      email,
      unite_id,
      capteur_id,
      cree_par,
    } = req.body;

    if (!source_type || !nom_demandeur || !type_alerte || !description) {
      return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

    const allowedSource = ["citoyen", "entreprise"];
    if (!allowedSource.includes(source_type)) {
      return res.status(400).json({ error: "source_type invalide." });
    }

    // Normaliser le type (accepte codes courts ET labels complets)
    console.log("[createAlerte] type_alerte reçu:", JSON.stringify(type_alerte));
    const typeNorm = TYPE_NORMALIZE[type_alerte];
    console.log("[createAlerte] typeNorm:", JSON.stringify(typeNorm));
    if (!typeNorm) {
      return res.status(400).json({
        error: `type_alerte invalide. Valeurs acceptées : ${Object.keys(TYPE_NORMALIZE).join(", ")}`,
      });
    }
    type_alerte = typeNorm;

    // Priorité calculée automatiquement — non modifiable par le client
    const priorite = getPrioriteFromType(type_alerte);
    console.log("[createAlerte] priorite calculée:", priorite);

    // Statut par défaut : en_cours (l'alerte est immédiatement visible dans les onglets actifs)
    const [result] = await db.query(
      `INSERT INTO alertes
         (source_type, nom_demandeur, nom_entreprise, contact, email,
          unite_id, capteur_id, type_alerte, priorite, description, statut, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_cours', ?)`,
      [
        source_type,
        nom_demandeur,
        nom_entreprise || null,
        contact        || null,
        email          || null,
        unite_id       || null,
        capteur_id     || null,
        type_alerte,
        priorite,
        description,
        cree_par       || null,
      ]
    );

    const [rows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);

    // ── Notification broadcast (visible par admin + tech + data) ─────
    try {
      const notifTitle = TYPE_LABELS[type_alerte] || "Nouvelle alerte";
      const source = source_type === "entreprise" && nom_entreprise
        ? `Entreprise : ${nom_entreprise}`
        : `Citoyen : ${nom_demandeur}`;
      const notifMsg = `${source} — priorité ${priorite}. ${description.substring(0, 120)}`;
      await createNotif({
        user_id: null,
        type: 'ALERTE',
        title: notifTitle,
        message: notifMsg,
        link: 'alertes',
      });
    } catch (notifErr) {
      console.error("[notif] Erreur notif alerte:", notifErr.message);
    }
  } catch (err) {
    next(err);
  }
};
