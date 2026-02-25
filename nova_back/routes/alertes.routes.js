const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/alertes.controller");
const db = require("../config/db");
const { createNotif } = require("../utils/notif");

router.get("/", ctrl.getAlertes);
router.post("/", ctrl.createAlerte);


router.patch("/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { technicien_id } = req.body;

  try {
    if (technicien_id) {
      // Assignation : met à jour l'alerte
      await db.query(
        "UPDATE alertes SET technicien_id=?, statut='en_cours', assigned_at=NOW(), date_mise_a_jour=NOW() WHERE id=?",
        [technicien_id, id]
      );

      // Récupère les détails de l'alerte pour construire l'intervention
      const [alerteRows] = await db.query("SELECT * FROM alertes WHERE id=?", [id]);
      const alerte = alerteRows[0];

      // Vérifie si une intervention liée existe déjà
      const [existingIntv] = await db.query(
        "SELECT id FROM interventions WHERE alerte_id=? AND source_type='alerte'",
        [id]
      );

      if (existingIntv.length === 0) {
        // Crée une nouvelle intervention liée
        await db.query(
          `INSERT INTO interventions (titre, description, priorite, statut, technicien_id, source_type, alerte_id, assigned_at)
           VALUES (?, ?, ?, 'en_cours', ?, 'alerte', ?, NOW())`,
          [
            `Alerte externe #${id}`,
            alerte?.description || `Alerte externe #${id}`,
            alerte?.priorite || 'moyenne',
            technicien_id,
            id,
          ]
        );
      } else {
        // Met à jour le technicien de l'intervention existante
        await db.query(
          "UPDATE interventions SET technicien_id=? WHERE alerte_id=? AND source_type='alerte'",
          [technicien_id, id]
        );
      }

      // Notification privée pour le technicien
      try {
        await createNotif({
          user_id: Number(technicien_id),
          type: 'ALERTE',
          title: `Alerte externe assignée #${id}`,
          message: `Une alerte externe vous a été assignée. ${(alerte?.description || '').substring(0, 100)}`,
          link: 'alertes',
        });
      } catch (notifErr) {
        console.error("[notif] Erreur notif assign alerte:", notifErr.message);
      }
    } else {
      // Désassignation
      await db.query(
        "UPDATE alertes SET technicien_id=NULL, statut='nouveau', assigned_at=NULL, date_mise_a_jour=NOW() WHERE id=?",
        [id]
      );
      await db.query(
        "DELETE FROM interventions WHERE alerte_id=? AND source_type='alerte' AND statut NOT IN ('resolue','annulee')",
        [id]
      );
    }

    // Retourne l'alerte complète pour que le front puisse se synchroniser (statut inclus)
    const [updatedRows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.id = ?`,
      [id]
    );

    return res.json({ message: "Technicien assigné", alerte: updatedRows[0] || null });
  } catch (err) {
    console.error("Erreur assignation :", err);
    return res
      .status(500)
      .json({ error: "Erreur serveur interne", detail: err.message });
  }
});

// ── POST /alertes/:id/prendre — auto-assignation tech avec contrôle de concurrence ──
router.post("/:id/prendre", async (req, res) => {
  const { id } = req.params;
  const { technicien_id } = req.body;

  if (!technicien_id) {
    return res.status(400).json({ error: "technicien_id requis" });
  }

  try {
    // Verrou optimiste : WHERE technicien_id IS NULL garantit qu'un seul tech gagne
    console.log(`[POST /alertes/${id}/prendre] STEP 1 — UPDATE alertes`);
    const [result] = await db.query(
      "UPDATE alertes SET technicien_id=?, statut='en_cours', assigned_at=NOW(), date_mise_a_jour=NOW() WHERE id=? AND technicien_id IS NULL",
      [technicien_id, id]
    );
    console.log(`[POST /alertes/${id}/prendre] STEP 1 OK — affectedRows=${result.affectedRows}`);

    if (result.affectedRows === 0) {
      return res.status(409).json({ error: "Alerte déjà prise par un autre technicien." });
    }

    // Récupère l'alerte mise à jour (avec JOIN pour technicien_nom)
    console.log(`[POST /alertes/${id}/prendre] STEP 2 — SELECT alerte`);
    const [alerteRows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.id=?`,
      [id]
    );
    const alerte = alerteRows[0];
    console.log(`[POST /alertes/${id}/prendre] STEP 2 OK — alerte:`, alerte?.id, alerte?.statut);

    // Crée l'intervention liée
    console.log(`[POST /alertes/${id}/prendre] STEP 3 — INSERT interventions`);
    const [intResult] = await db.query(
      `INSERT INTO interventions (titre, description, priorite, statut, technicien_id, source_type, alerte_id, assigned_at)
       VALUES (?, ?, ?, 'en_cours', ?, 'alerte', ?, NOW())`,
      [
        `Alerte externe #${id}`,
        alerte?.description || `Alerte externe #${id}`,
        alerte?.priorite || 'moyenne',
        technicien_id,
        id,
      ]
    );
    console.log(`[POST /alertes/${id}/prendre] STEP 3 OK — intervention_id=${intResult.insertId}`);

    // Notification broadcast — admin et autres voient que l'alerte est prise
    try {
      await createNotif({
        user_id: null,
        type: 'INTERVENTION',
        title: `Alerte #${id} prise en charge`,
        message: `Intervention #${intResult.insertId} créée automatiquement suite à la prise en charge de l'alerte #${id}.`,
        link: 'interventions',
      });
    } catch (notifErr) {
      console.error("[notif] Erreur notif prendre:", notifErr.message);
    }

    return res.json({
      message: "Alerte prise en charge",
      alerte,
      intervention_id: intResult.insertId,
    });
  } catch (err) {
    console.error(`[POST /alertes/${id}/prendre] ERREUR SQL:`, err.message);
    return res.status(500).json({ error: "Erreur serveur interne", detail: err.message });
  }
});


router.patch("/:id/statut", async (req, res) => {
  const { id } = req.params;
  const { statut, technicien_id } = req.body;

  console.log(`[PATCH /alertes/${id}/statut] statut="${statut}" technicien_id=${technicien_id ?? "null"}`);

  try {
    const [result] = await db.query(
      "UPDATE alertes SET statut = ?, traite_par = ?, date_mise_a_jour = NOW() WHERE id = ?",
      [statut, technicien_id || null, id]
    );

    console.log(`[PATCH /alertes/${id}/statut] affectedRows=${result.affectedRows}`);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Alerte introuvable (id inexistant)" });
    }

    // Retourner la ligne mise à jour pour que le front puisse se synchroniser
    const [rows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.id = ?`,
      [id]
    );

    // Notification broadcast pour les statuts significatifs
    if (['resolue', 'traitee', 'annulee'].includes(statut)) {
      try {
        const labels = { resolue: 'résolue', traitee: 'traitée', annulee: 'annulée' };
        await createNotif({
          user_id: null,
          type: 'ALERTE',
          title: `Alerte #${id} ${labels[statut]}`,
          message: `L'alerte externe #${id} a été marquée comme ${labels[statut]}.`,
          link: 'alertes',
        });
      } catch (notifErr) {
        console.error("[notif] Erreur notif statut alerte:", notifErr.message);
      }
    }

    return res.json({ message: "Statut mis à jour", alerte: rows[0] || null });
  } catch (err) {
    console.error(`[PATCH /alertes/${id}/statut] ERREUR SQL:`, err.message);
    return res
      .status(500)
      .json({ error: "Erreur serveur interne", detail: err.message });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM alertes WHERE id = ?", [req.params.id]);
    return res.json({ message: "Alerte supprimée" });
  } catch (err) {
    console.error("Erreur suppression alerte :", err);
    return res.status(500).json({ error: "Erreur serveur interne" });
  }
});

router.get("/historique", async (req, res) => {
  console.log("[GET /alertes/historique] requête reçue");
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.statut IN ('traitee', 'annulee')
       ORDER BY COALESCE(a.date_mise_a_jour, a.date_creation) DESC`
    );
    console.log(`[GET /alertes/historique] ${rows.length} résultat(s) — statuts:`, rows.map(r => r.statut));
    return res.json(rows);
  } catch (err) {
    console.error("[GET /alertes/historique] ERREUR SQL:", err.message);
    return res
      .status(500)
      .json({ error: "Erreur serveur interne", detail: err.message });
  }
});


router.get("/by-creator/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.cree_par = ?
       ORDER BY a.date_creation DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Erreur getByCreator :", err);
    return res.status(500).json({ error: "Erreur serveur interne", detail: err.message });
  }
});

router.get("/by-tech/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT a.*, u.nom AS technicien_nom
       FROM alertes a
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.technicien_id = ?
       ORDER BY a.date_creation DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Erreur getByTechnician :", err);
    return res
      .status(500)
      .json({ error: "Erreur serveur interne", detail: err.message });
  }
});

// ── POST /alertes/interne ─────────────────────────────────────────────
router.post("/interne", async (req, res) => {
  const { categorie, priorite, description, cree_par } = req.body;
  if (!categorie || !description || !cree_par) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  const validPrio = ["haute", "moyenne", "basse"];
  const prioFinal = validPrio.includes(priorite) ? priorite : "basse";
  try {
    const [result] = await db.query(
      `INSERT INTO alertes_internes (categorie, priorite, description, cree_par)
       VALUES (?, ?, ?, ?)`,
      [categorie, prioFinal, description, cree_par]
    );
    const [rows] = await db.query(
      `SELECT a.*, c.nom AS createur_nom, c.role AS createur_role,
              u.nom AS technicien_nom
       FROM alertes_internes a
       LEFT JOIN utilisateurs c ON c.id = a.cree_par
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.id = ?`,
      [result.insertId]
    );
    const created = rows[0];

    // Notification broadcast — visible par admin + tech + data
    try {
      const roleLabel = { admin: 'Admin', technicien: 'Tech', tech: 'Tech', data: 'Data' }[created?.createur_role] ?? created?.createur_role ?? 'Utilisateur';
      await createNotif({
        user_id: null,
        type: 'ALERTE_INTERNE',
        title: `Alerte interne — ${categorie}`,
        message: `${created?.createur_nom ?? 'Quelqu\'un'} (${roleLabel}) : ${description.substring(0, 120)}`,
        link: 'alertes-internes',
      });
    } catch (notifErr) {
      console.error("[notif] Erreur notif alerte interne:", notifErr.message);
    }

    return res.status(201).json(created);
  } catch (err) {
    console.error("[POST /alertes/interne] ERREUR:", err.message);
    return res.status(500).json({ error: "Erreur serveur interne", detail: err.message });
  }
});

// ── GET /alertes/interne ─────────────────────────────────────────────
router.get("/interne", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, c.nom AS createur_nom, c.role AS createur_role,
              u.nom AS technicien_nom
       FROM alertes_internes a
       LEFT JOIN utilisateurs c ON c.id = a.cree_par
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       ORDER BY a.date_creation DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("[GET /alertes/interne] ERREUR:", err.message);
    return res.status(500).json({ error: "Erreur serveur interne", detail: err.message });
  }
});

// ── PATCH /alertes/interne/:id ───────────────────────────────────────
router.patch("/interne/:id", async (req, res) => {
  const { id } = req.params;
  const { statut, technicien_id } = req.body;
  const fields = [];
  const params = [];
  if (statut !== undefined)        { fields.push("statut = ?");        params.push(statut); }
  if (technicien_id !== undefined) { fields.push("technicien_id = ?"); params.push(technicien_id || null); }
  if (!fields.length) {
    return res.status(400).json({ error: "Aucun champ à modifier." });
  }
  fields.push("date_mise_a_jour = NOW()");
  params.push(id);
  try {
    await db.query(
      `UPDATE alertes_internes SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
    const [rows] = await db.query(
      `SELECT a.*, c.nom AS createur_nom, c.role AS createur_role,
              u.nom AS technicien_nom
       FROM alertes_internes a
       LEFT JOIN utilisateurs c ON c.id = a.cree_par
       LEFT JOIN utilisateurs u ON u.id = a.technicien_id
       WHERE a.id = ?`,
      [id]
    );
    // Notification broadcast quand une alerte interne change de statut
    if (['traitee', 'annulee'].includes(statut)) {
      try {
        const labels = { traitee: 'traitée', annulee: 'annulée' };
        await createNotif({
          user_id: null,
          type: 'ALERTE_INTERNE',
          title: `Alerte interne #${id} ${labels[statut]}`,
          message: `L'alerte interne #${id} a été marquée comme ${labels[statut]}.`,
          link: 'alertes-internes',
        });
      } catch (notifErr) {
        console.error("[notif] Erreur notif interne statut:", notifErr.message);
      }
    }

    return res.json(rows[0] || { message: "Mis à jour" });
  } catch (err) {
    console.error("[PATCH /alertes/interne] ERREUR:", err.message);
    return res.status(500).json({ error: "Erreur serveur interne", detail: err.message });
  }
});

// ── DELETE /alertes/interne/:id ──────────────────────────────────────
router.delete("/interne/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM alertes_internes WHERE id = ?", [req.params.id]);
    return res.json({ message: "Alerte interne supprimée" });
  } catch (err) {
    console.error("[DELETE /alertes/interne] ERREUR:", err.message);
    return res.status(500).json({ error: "Erreur serveur interne" });
  }
});

module.exports = router;
