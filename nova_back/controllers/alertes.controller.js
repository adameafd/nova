
const db = require("../config/db");


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
      sql += " AND a.source_type = ? ";
      params.push(source_type);
    }

    if (statut) {
      sql += " AND a.statut = ? ";
      params.push(statut);
    }

    // Support filtering by type_alerte (sujet)
    const typeFilter = type_alerte || sujet;
    if (typeFilter) {
      sql += " AND a.type_alerte = ? ";
      params.push(typeFilter);
    }

    if (priorite) {
      sql += " AND a.priorite = ? ";
      params.push(priorite);
    }

    sql += " ORDER BY a.date_creation DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};


exports.createAlerte = async (req, res, next) => {
  try {
    let {
      source_type,
      nom_demandeur,
      type_alerte,
      priorite,
      description,
      nom_entreprise,
      contact,
      email,
      unite_id,
      capteur_id,
      cree_par
    } = req.body;


    if (!source_type || !nom_demandeur || !type_alerte || !description) {
      return res
        .status(400)
        .json({ error: "Champs obligatoires manquants." });
    }

    const allowedSource = ["citoyen", "entreprise"];
    if (!allowedSource.includes(source_type)) {
      return res.status(400).json({ error: "source_type invalide." });
    }

    const allowedType = ["panne", "proposition", "autre"];
    if (!allowedType.includes(type_alerte)) {
      return res.status(400).json({ error: "type_alerte invalide." });
    }

    const allowedPriorite = ["basse", "moyenne", "haute"];
    priorite = allowedPriorite.includes(priorite) ? priorite : "moyenne";


    const [result] = await db.query(
      `
      INSERT INTO alertes
        (source_type, nom_demandeur, nom_entreprise, contact, email,
         unite_id, capteur_id, type_alerte, priorite, description, statut, cree_par)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nouveau', ?)
      `,
      [
        source_type,
        nom_demandeur,
        nom_entreprise || null,
        contact || null,
        email || null,
        unite_id || null,
        capteur_id || null,
        type_alerte,
        priorite,
        description,
        cree_par || null
      ]
    );

    const [rows] = await db.query(
      `
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
      WHERE a.id = ?
      `,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};
