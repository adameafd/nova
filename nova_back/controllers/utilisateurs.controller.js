const pool = require("../config/db");


exports.getAllUsers = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        id,
        civilite,
        nom,
        email,
        role,
        photo_url,
        date_creation,
        statut_activite,
        derniere_connexion
       FROM utilisateurs
       ORDER BY date_creation DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { civilite = "", nom, email, mot_de_passe, role } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!nom || !email || !mot_de_passe || !role) {
      return res.status(400).json({ error: "Champs obligatoires manquants (nom, email, mot_de_passe, role)" });
    }

    // Vérifier email valide
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Format d'email invalide" });
    }

    // Vérifier unicité email
    const [existing] = await pool.query("SELECT id FROM utilisateurs WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Un utilisateur avec cet email existe déjà" });
    }

    const [result] = await pool.query(
      `INSERT INTO utilisateurs
        (civilite, nom, email, mot_de_passe, role, photo_url, statut_activite)
       VALUES (?, ?, ?, ?, ?, ?, 'hors_ligne')  -- statut_activite VARCHAR(20)`,
      [civilite, nom, email, mot_de_passe, role, photo_url]
    );

    const [rows] = await pool.query(
      `SELECT
        id,
        civilite,
        nom,
        email,
        role,
        photo_url,
        date_creation,
        statut_activite,
        derniere_connexion
       FROM utilisateurs
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};


exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { civilite, nom, email, mot_de_passe, role, statut_activite } = req.body;

    // Récupérer l'utilisateur actuel
    const [existingRows] = await pool.query(
      "SELECT * FROM utilisateurs WHERE id = ?",
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }
    const current = existingRows[0];

    const photo_url = req.file ? `/uploads/${req.file.filename}` : current.photo_url;

    const newPassword =
      mot_de_passe && mot_de_passe.trim() !== ""
        ? mot_de_passe
        : current.mot_de_passe;

    await pool.query(
      `UPDATE utilisateurs
       SET civilite = ?,
           nom = ?,
           email = ?,
           mot_de_passe = ?,
           role = ?,
           photo_url = ?,
           statut_activite = ?
       WHERE id = ?`,
      [
        civilite ?? current.civilite,
        nom ?? current.nom,
        email ?? current.email,
        newPassword,
        role ?? current.role,
        photo_url,
        statut_activite ?? current.statut_activite,
        id,
      ]
    );

    const [rows] = await pool.query(
      `SELECT 
        id,
        civilite,
        nom,
        email,
        role,
        photo_url,
        date_creation,
        statut_activite,
        derniere_connexion
       FROM utilisateurs
       WHERE id = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};


exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM utilisateurs WHERE id = ?", [id]);
    res.json({ message: "Utilisateur supprimé ✅" });
  } catch (err) {
    next(err);
  }
};
