const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { createNotif } = require("../utils/notif");

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
             i.source_type,
             i.alerte_id,
             i.assigned_at,
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

    const created = rows[0];
    res.status(201).json(created);

    // Notification : broadcast (admin + tech + data) + privée pour le technicien assigné
    try {
      const techNom = created?.technicien_nom ?? 'Technicien';
      const msg = `Assignée à ${techNom} — priorité ${prio}. ${description.substring(0, 100)}`;
      // Broadcast
      await createNotif({
        user_id: null,
        type: 'INTERVENTION',
        title: `Nouvelle intervention : ${titre}`,
        message: msg,
        link: 'interventions',
      });
      // Notification privée pour le technicien concerné
      if (Number(technicien_id)) {
        await createNotif({
          user_id: Number(technicien_id),
          type: 'INTERVENTION',
          title: `Intervention assignée : ${titre}`,
          message: `Priorité ${prio}. ${description.substring(0, 100)}`,
          link: 'interventions',
        });
      }
    } catch (notifErr) {
      console.error("[notif] Erreur notif intervention:", notifErr.message);
    }
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

    // Sync alerte liée si l'intervention est résolue ou annulée
    if (statut && ['resolue', 'annulee'].includes(statut)) {
      try {
        const [intRows] = await db.query(
          "SELECT alerte_id, technicien_id FROM interventions WHERE id=?",
          [id]
        );
        const intv = intRows[0];
        if (intv?.alerte_id) {
          const alerteStatut = statut === 'resolue' ? 'traitee' : 'annulee';
          await db.query(
            "UPDATE alertes SET statut=?, traite_par=?, date_mise_a_jour=NOW() WHERE id=?",
            [alerteStatut, intv.technicien_id, intv.alerte_id]
          );
        }
      } catch (syncErr) {
        console.error("[interventions] Erreur sync alerte:", syncErr.message);
      }
    }
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
