/**
 * Middleware d'authentification par API Key pour l'endpoint telemetry.
 * L'ESP32 doit envoyer le header : x-api-key: <TELEMETRY_API_KEY>
 */
module.exports = function apiKeyAuth(req, res, next) {
  const key = req.headers["x-api-key"];
  const expected = process.env.TELEMETRY_API_KEY;

  if (!expected) {
    console.warn("[apiKeyAuth] TELEMETRY_API_KEY non défini dans .env — auth désactivée");
    return next();
  }

  if (!key || key !== expected) {
    return res.status(401).json({ error: "API key invalide ou manquante (header x-api-key)" });
  }

  next();
};
