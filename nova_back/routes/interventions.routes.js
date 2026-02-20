const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", async (req, res, next) => {
  try {
    const { technicien_id } = req.query;

    let sql = `
      SELECT i.id,
             i.titre,
             i.description,
             i.priorite,
             i.statut,
             i.unite,
             i.date_creation,
             i.date_maj,
             u.id  AS technicien_id,
             u.nom AS technicien_nom
      FROM interventions i
      JOIN utilisateurs u ON u.id = i.technicien_id
    `;

    const params = [];

    if (technicien_id) {
      sql += " WHERE i.technicien_id = ? ";
      params.push(technicien_id);
    }

    sql += " ORDER BY i.date_creation DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});


router.post("/", async (req, res, next) => {
  try {
    const { titre, description, priorite, statut, unite, technicien_id } = req.body;

    if (!titre || !description || !technicien_id) {
      return res.status(400).json({ message: "Champs obligatoires manquants" });
    }

    const prioAllowed = ["basse", "moyenne", "haute", "critique"];
    const prio = prioAllowed.includes((priorite || "").toLowerCase())
      ? priorite.toLowerCase()
      : "moyenne";

    const statutAllowed = ["en_attente", "en_cours", "resolue", "annulee"];
    const safeStatut = statutAllowed.includes((statut || "").toLowerCase())
      ? statut.toLowerCase()
      : "en_attente";

    const [result] = await db.query(
      `
      INSERT INTO interventions (titre, description, priorite, statut, unite, technicien_id)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [titre, description, prio, safeStatut, unite || null, technicien_id]
    );

    const [rows] = await db.query(
      `SELECT i.*, u.nom AS technicien_nom
       FROM interventions i
       JOIN utilisateurs u ON u.id = i.technicien_id
       WHERE i.id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});


router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut, priorite } = req.body;

    const fields = [];
    const params = [];

    if (statut) {
      fields.push("statut = ?");
      params.push(statut);
    }
    if (priorite) {
      fields.push("priorite = ?");
      params.push(priorite);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Rien à mettre à jour" });
    }

    params.push(id);

    await db.query(
      `UPDATE interventions SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    const [rows] = await db.query(
      `SELECT i.*, u.nom AS technicien_nom
       FROM interventions i
       JOIN utilisateurs u ON u.id = i.technicien_id
       WHERE i.id = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM interventions WHERE id = ?", [req.params.id]);
    res.json({ message: "Intervention supprimée" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
