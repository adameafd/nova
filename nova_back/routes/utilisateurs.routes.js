const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const { compressImage } = require("../middlewares/upload");
const ctrl = require("../controllers/utilisateurs.controller");
const db = require("../config/db");

router.get("/", ctrl.getAllUsers);
router.post("/", upload.single("photo"), compressImage, ctrl.createUser);
router.put("/:id", upload.single("photo"), compressImage, ctrl.updateUser);
router.delete("/:id", ctrl.deleteUser);

router.get("/techniciens", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nom, email FROM utilisateurs WHERE role IN ('tech', 'technicien') ORDER BY nom ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Erreur chargement techniciens :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
