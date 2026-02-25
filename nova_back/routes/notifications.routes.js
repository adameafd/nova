const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET /api/notifications/latest?userId=X&limit=20
router.get("/latest", async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    const limit  = parseInt(req.query.limit,  10) || 20;

    if (!userId) {
      console.warn("[notif] GET /latest appelé sans userId valide:", req.query.userId);
      return res.status(400).json({ error: "userId requis" });
    }

    console.log(`[notif] GET /latest → userId=${userId} limit=${limit}`);

    let rows;
    try {
      // Requête complète — toutes les colonnes (title + link ajoutées par migrations)
      [rows] = await db.query(
        `SELECT id, user_id, type, title, message, link, is_read, created_at
         FROM notifications
         WHERE user_id = ? OR user_id IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );
    } catch (sqlErr) {
      // Fallback robuste : n'utilise QUE les colonnes de base garanties (init.sql)
      // NULL AS title / link pour garder la même forme de réponse
      console.warn(`[notif] Fallback colonnes de base (${sqlErr.code}):`, sqlErr.message);
      [rows] = await db.query(
        `SELECT id, user_id, type,
                NULL AS title, message, NULL AS link,
                is_read, created_at
         FROM notifications
         WHERE user_id = ? OR user_id IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );
    }

    console.log(`[notif] GET /latest → ${rows.length} notification(s) retournée(s)`);
    res.json(rows);
  } catch (err) {
    console.error("[notif] Erreur GET /latest:", err.message);
    next(err);
  }
});

// POST /api/notifications
router.post("/", async (req, res, next) => {
  try {
    const { user_id, type, title, message, link } = req.body;
    if (!message) return res.status(400).json({ error: "message requis" });

    let result;
    try {
      [result] = await db.query(
        "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)",
        [user_id || null, type || "INFO", title || null, message, link || null]
      );
    } catch (sqlErr) {
      // Fallback sans title
      if (sqlErr.code === "42703") {
        [result] = await db.query(
          "INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)",
          [user_id || null, type || "INFO", message, link || null]
        );
      } else throw sqlErr;
    }

    const [rows] = await db.query(
      "SELECT * FROM notifications WHERE id = ?",
      [result.insertId]
    );
    console.log("[notif] Notification créée manuellement id=", result.insertId);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/mark-read
router.post("/mark-read", async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ error: "notificationId requis" });
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [notificationId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/mark-all-read
router.post("/mark-all-read", async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (userId) {
      await db.query(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL",
        [userId]
      );
    } else {
      await db.query("UPDATE notifications SET is_read = 1 WHERE user_id IS NULL");
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/mark-read
router.patch("/:id/mark-read", async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
    console.log(`[notif] PATCH /${id}/mark-read → OK`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notifications/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM notifications WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
