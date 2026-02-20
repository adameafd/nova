const express = require("express");
const router = express.Router();
const db = require("../config/db");
const upload = require("../middlewares/upload");
const multer = require("multer");

console.log("[comptes-rendus] Route chargee avec succes");

// GET /api/compte-rendus — Admin : tous les rapports
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT cr.*, u.nom AS auteur_nom, u.email AS auteur_email
      FROM comptes_rendus cr
      LEFT JOIN utilisateurs u ON cr.created_by = u.id
      ORDER BY cr.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("[comptes-rendus] GET / erreur :", err.message);
    next(err);
  }
});

// GET /api/compte-rendus/mine?userId=X — Data : historique perso
router.get("/mine", async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) return res.status(400).json({ message: "userId manquant" });

    const [rows] = await db.query(
      "SELECT * FROM comptes_rendus WHERE created_by = ? ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("[comptes-rendus] GET /mine erreur :", err.message);
    next(err);
  }
});

// GET /api/compte-rendus/:id — Consulter un rapport
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT cr.*, u.nom AS auteur_nom
      FROM comptes_rendus cr
      LEFT JOIN utilisateurs u ON cr.created_by = u.id
      WHERE cr.id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "Rapport introuvable" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[comptes-rendus] GET /:id erreur :", err.message);
    next(err);
  }
});

// POST /api/compte-rendus — Data ajoute un rapport
// Wrapper pour catcher les erreurs multer (Express 5 compatible)
router.post("/", (req, res, next) => {
  upload.single("fichier")(req, res, async (multerErr) => {
    try {
      // Erreur multer (taille, type, etc.)
      if (multerErr) {
        console.error("[comptes-rendus] Multer erreur :", multerErr.message);
        if (multerErr instanceof multer.MulterError) {
          if (multerErr.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "Fichier trop volumineux (max 50 Mo)." });
          }
          return res.status(400).json({ message: `Erreur upload : ${multerErr.message}` });
        }
        return res.status(400).json({ message: multerErr.message || "Erreur lors de l'upload du fichier." });
      }

      const { titre, type, created_by } = req.body;

      console.log("[comptes-rendus] POST recu :", {
        titre, type, created_by,
        fichier: req.file?.originalname,
        size: req.file?.size,
      });

      if (!req.file) {
        return res.status(400).json({ message: "Fichier requis." });
      }
      if (!type || !type.trim()) {
        return res.status(400).json({ message: "Le type de rapport est requis." });
      }
      if (!created_by) {
        return res.status(400).json({ message: "Identifiant utilisateur (created_by) requis." });
      }

      const fichier_url = `/uploads/${req.file.filename}`;
      const nom_fichier = req.file.originalname;

      const [result] = await db.query(
        "INSERT INTO comptes_rendus (titre, type, fichier_url, nom_fichier, created_by) VALUES (?, ?, ?, ?, ?)",
        [titre || null, type, fichier_url, nom_fichier, parseInt(created_by, 10)]
      );

      console.log("[comptes-rendus] Rapport cree, id :", result.insertId);

      const [rows] = await db.query("SELECT * FROM comptes_rendus WHERE id = ?", [result.insertId]);

      // Créer une notification automatique
      try {
        const [userRows] = await db.query("SELECT nom FROM utilisateurs WHERE id = ?", [parseInt(created_by, 10)]);
        const userName = userRows[0]?.nom || "Utilisateur";
        const notifMsg = `${userName} a ajouté un compte rendu : ${titre || nom_fichier}`;
        await db.query(
          "INSERT INTO notifications (user_id, type, message, link) VALUES (NULL, 'COMPTE_RENDU', ?, 'compte-rendu')",
          [notifMsg]
        );
        console.log("[notif] Notification compte rendu créée");
      } catch (notifErr) {
        console.error("[notif] Erreur création notif CR:", notifErr.message);
      }

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[comptes-rendus] POST erreur :", err.code, err.message);
      if (err.code === "ER_NO_SUCH_TABLE") {
        return res.status(500).json({
          message: "Table 'comptes_rendus' introuvable. Executez la migration SQL.",
        });
      }
      res.status(500).json({ message: "Erreur serveur lors de l'enregistrement du rapport." });
    }
  });
});

// DELETE /api/compte-rendus/:id — Admin supprime
router.delete("/:id", async (req, res, next) => {
  try {
    const fs = require("fs");
    const path = require("path");

    // Recuperer le fichier avant suppression pour le supprimer du disque
    const [rows] = await db.query("SELECT fichier_url FROM comptes_rendus WHERE id = ?", [req.params.id]);
    if (rows.length > 0 && rows[0].fichier_url) {
      const filePath = path.join(__dirname, "..", rows[0].fichier_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("[comptes-rendus] Fichier supprime :", filePath);
      }
    }

    await db.query("DELETE FROM comptes_rendus WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("[comptes-rendus] DELETE erreur :", err.message);
    next(err);
  }
});

module.exports = router;
