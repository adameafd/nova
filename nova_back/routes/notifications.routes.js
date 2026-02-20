const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET /api/notifications/latest?userId=X&limit=10
router.get("/latest", async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    const limit = parseInt(req.query.limit, 10) || 10;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    const [rows] = await db.query(
      `SELECT id, user_id, type, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications
router.post("/", async (req, res, next) => {
  try {
    const { user_id, type, message, link } = req.body;
    if (!message) return res.status(400).json({ error: "message requis" });

    const [result] = await db.query(
      "INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)",
      [user_id || null, type || "INFO", message, link || null]
    );

    const [rows] = await db.query("SELECT * FROM notifications WHERE id = ?", [result.insertId]);
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

module.exports = router;
