const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET /api/messages?user1=X&user2=Y
router.get("/", async (req, res, next) => {
  try {
    const { user1, user2 } = req.query;

    if (!user1 || !user2) {
      return res
        .status(400)
        .json({ message: "user1 et user2 sont obligatoires" });
    }

    const [rows] = await db.query(
      `
      SELECT id,
             expediteur_id,
             destinataire_id,
             contenu,
             date_envoi,
             lu,
             modifie
      FROM messages
      WHERE (expediteur_id = ? AND destinataire_id = ?)
         OR (expediteur_id = ? AND destinataire_id = ?)
      ORDER BY date_envoi ASC
      `,
      [user1, user2, user2, user1]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/messages
router.post("/", async (req, res, next) => {
  try {
    const { expediteur_id, destinataire_id, contenu } = req.body;

    if (!expediteur_id || !destinataire_id || !contenu) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    const [result] = await db.query(
      `
      INSERT INTO messages (expediteur_id, destinataire_id, contenu, lu)
      VALUES (?, ?, ?, 0)
      `,
      [expediteur_id, destinataire_id, contenu]
    );

    const [rows] = await db.query(
      `SELECT * FROM messages WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/summary?userId=X
router.get("/summary", async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) {
      return res.status(400).json({ message: "userId manquant" });
    }

    const [rows] = await db.query(
      `
      SELECT
        CASE
          WHEN expediteur_id = ? THEN destinataire_id
          ELSE expediteur_id
        END AS other_user_id,
        MAX(date_envoi) AS last_date,
        SUM(
          CASE
            WHEN destinataire_id = ? AND lu = 0 THEN 1
            ELSE 0
          END
        ) AS unread_count
      FROM messages
      WHERE expediteur_id = ? OR destinataire_id = ?
      GROUP BY other_user_id
      `,
      [userId, userId, userId, userId]
    );

    const results = [];

    for (const row of rows) {
      const otherId = row.other_user_id;

      const [lastRows] = await db.query(
        `
        SELECT contenu
        FROM messages
        WHERE (expediteur_id = ? AND destinataire_id = ?)
           OR (expediteur_id = ? AND destinataire_id = ?)
        ORDER BY date_envoi DESC
        LIMIT 1
        `,
        [userId, otherId, otherId, userId]
      );

      results.push({
        other_user_id: otherId,
        last_date: row.last_date,
        unread_count: row.unread_count,
        last_text: lastRows[0] ? lastRows[0].contenu : null,
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/mark-read
router.post("/mark-read", async (req, res, next) => {
  try {
    const { fromUserId, toUserId } = req.body;

    if (!fromUserId || !toUserId) {
      return res
        .status(400)
        .json({ message: "fromUserId et toUserId sont obligatoires" });
    }

    await db.query(
      `
      UPDATE messages
      SET lu = 1
      WHERE expediteur_id = ?
        AND destinataire_id = ?
        AND lu = 0
      `,
      [fromUserId, toUserId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/messages/:id/lu
router.patch("/:id/lu", async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(`UPDATE messages SET lu = 1 WHERE id = ?`, [id]);

    res.json({ id, lu: 1 });
  } catch (err) {
    next(err);
  }
});

// PUT /api/messages/:id  (modifier un message)
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenu, expediteur_id } = req.body;

    if (!contenu || !expediteur_id) {
      return res.status(400).json({ message: "contenu et expediteur_id sont obligatoires" });
    }

    const [result] = await db.query(
      `UPDATE messages SET contenu = ?, modifie = 1 WHERE id = ? AND expediteur_id = ?`,
      [contenu, id, expediteur_id]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({ message: "Message introuvable ou non autorisé" });
    }

    const [rows] = await db.query(`SELECT * FROM messages WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/messages/:id?expediteur_id=X
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const expediteur_id = req.query.expediteur_id || req.body?.expediteur_id;

    if (!expediteur_id) {
      return res.status(400).json({ message: "expediteur_id est obligatoire" });
    }

    const [result] = await db.query(
      `DELETE FROM messages WHERE id = ? AND expediteur_id = ?`,
      [id, expediteur_id]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({ message: "Message introuvable ou non autorisé" });
    }

    res.json({ success: true, id: Number(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
