const pool = require("../config/db");

exports.login = async (req, res, next) => {
  try {
    const { email, mot_de_passe } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM utilisateurs WHERE email=? AND mot_de_passe=?",
      [email, mot_de_passe]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
};
