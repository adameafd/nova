const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/alertes.controller");
const db = require("../config/db"); 

router.get("/", ctrl.getAlertes);
router.post("/", ctrl.createAlerte);


router.patch("/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { technicien_id } = req.body;

  try {
    await db.query(
      "UPDATE alertes SET technicien_id = ?, date_mise_a_jour = NOW() WHERE id = ?",
      [technicien_id || null, id]
    );

    return res.json({ message: "Technicien assigné", id, technicien_id });
  } catch (err) {
    console.error("Erreur assignation :", err);
    return res
      .status(500)
      .json({ error: "Erreur serveur interne", detail: err.message });
  }
});


router.patch("/:id/statut", async (req, res) => {
  const { id } = req.params;
  const { statut, technicien_id } = req.body;

  try {

    await db.query(
      "UPDATE alertes SET statut = ?, traite_par = ?, date_mise_a_jour = NOW() WHERE id = ?",
      [statut, technicien_id || null, id]
    );

    if (statut !== "resolue") {
      return res.json({ message: "Statut mis à jour" });
    }

    const [rows] = await db.query("SELECT * FROM alertes WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Alerte introuvable" });
    }

    const a = rows[0];


    const insertData = {
      source_type: a.source_type,
      nom_demandeur: a.nom_demandeur,
      nom_entreprise: a.nom_entreprise,
      contact: a.contact,
      email: a.email,
      unite_id: a.unite_id,
      capteur_id: a.capteur_id,
      type_alerte: a.type_alerte,
      priorite: a.priorite,
      description: a.description,
      statut: a.statut,
      date_creation: a.date_creation,
      date_traitement: a.date_mise_a_jour,
      cree_par: a.cree_par,
      technicien_id: a.technicien_id,
      traite_par: a.traite_par,
    };


    await db.query("INSERT INTO alertes_historique SET ?", [insertData]);


    await db.query("DELETE FROM alertes WHERE id = ?", [id]);

    return res.json({ message: "Statut mis à jour et archivé" });
  } catch (err) {
    console.error("Erreur patch statut :", err);
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
  try {
    const [rows] = await db.query(
      `SELECT h.*, u.nom AS technicien_nom
       FROM alertes_historique h
       LEFT JOIN utilisateurs u ON u.id = h.technicien_id
       ORDER BY h.date_creation DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("Erreur historique :", err);
    return res
      .status(500)
      .json({ error: "Erreur serveur interne", detail: err.message });
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

module.exports = router;
