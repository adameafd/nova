const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/stock.controller");
const db = require("../config/db"); 

router.get("/", ctrl.getStock);


router.post("/", ctrl.createStockItem);


router.put("/:id", ctrl.updateStockItem);


router.delete("/:id", ctrl.deleteStockItem);


router.get("/etat-critique", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        nom,
        quantite
      FROM stock
      WHERE quantite <= 5
      ORDER BY quantite ASC
      LIMIT 20
      `
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erreur /stock/etat-critique :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
