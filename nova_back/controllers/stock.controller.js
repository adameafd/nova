const pool = require("../config/db");


function generateCode(nom) {
  if (!nom) return "";
  const parts = nom.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nom.substring(0, 2).toUpperCase();
}


exports.getStock = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM stock ORDER BY nom ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};


exports.createStockItem = async (req, res, next) => {
  try {
    const { nom, categorie, quantite } = req.body;

    if (!nom || !categorie || quantite == null) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    const code = generateCode(nom);
    const seuil_alerte = 5; 
    const total_utilise = 0;

    const [result] = await pool.query(
      `INSERT INTO stock (nom, code, categorie, quantite, seuil_alerte, total_utilise)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, code, categorie, quantite, seuil_alerte, total_utilise]
    );

    const [rows] = await pool.query(
      "SELECT * FROM stock WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};


exports.updateStockItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, categorie, quantite, seuil_alerte, total_utilise } = req.body;

    const [existingRows] = await pool.query(
      "SELECT * FROM stock WHERE id = ?",
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Produit introuvable" });
    }
    const current = existingRows[0];

    const newNom = nom ?? current.nom;
    const newCategorie = categorie ?? current.categorie;
    const newQuantite =
      quantite == null ? current.quantite : quantite;
    const newSeuil =
      seuil_alerte == null ? current.seuil_alerte : seuil_alerte;
    const newUsed =
      total_utilise == null ? current.total_utilise : total_utilise;

    const code = generateCode(newNom);

    await pool.query(
      `UPDATE stock
       SET nom = ?, code = ?, categorie = ?, quantite = ?, seuil_alerte = ?, total_utilise = ?
       WHERE id = ?`,
      [newNom, code, newCategorie, newQuantite, newSeuil, newUsed, id]
    );

    // Notification si stock faible / rupture (éviter doublons)
    if (newQuantite <= newSeuil) {
      try {
        const [existing] = await pool.query(
          "SELECT id FROM notifications WHERE type = 'STOCK' AND is_read = 0 AND message LIKE ?",
          [`%${newNom}%`]
        );
        if (existing.length === 0) {
          const msg = newQuantite === 0
            ? `Rupture de stock : ${newNom}`
            : `Stock faible : ${newNom} (${newQuantite} unité${newQuantite > 1 ? "s" : ""})`;
          await pool.query(
            "INSERT INTO notifications (user_id, type, message, link) VALUES (NULL, 'STOCK', ?, 'stock')",
            [msg]
          );
          console.log("[notif] Notification stock créée pour", newNom);
        }
      } catch (notifErr) {
        console.error("[notif] Erreur création notif stock:", notifErr.message);
      }
    }

    const [rows] = await pool.query(
      "SELECT * FROM stock WHERE id = ?",
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};


exports.deleteStockItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM stock WHERE id = ?", [id]);
    res.json({ message: "Produit supprimé ✅" });
  } catch (err) {
    next(err);
  }
};
