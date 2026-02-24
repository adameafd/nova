const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/telemetry.controller");
const apiKeyAuth = require("../middlewares/apiKeyAuth");

// GET /api/telemetry/test — vérifie la connexion et les tables
router.get("/test",           ctrl.test);

// POST /api/telemetry — réception données ESP32 (protégé par API key)
router.post("/",              apiKeyAuth, ctrl.receive);

// GET /api/telemetry/latest?deviceId=...
router.get("/latest",         ctrl.getLatest);

// GET /api/telemetry/history?deviceId=...&range=10m|1h|24h
router.get("/history",        ctrl.getHistory);

// GET /api/telemetry/devices
router.get("/devices",        ctrl.getDevices);

module.exports = router;
