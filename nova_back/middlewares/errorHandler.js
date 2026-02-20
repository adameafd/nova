module.exports = (err, req, res, next) => {
  console.error("API Error:", err.message || err);

  const status = err.status || err.statusCode || 500;
  const msg = status === 500 ? "Erreur serveur interne" : err.message;

  res.status(status).json({
    error: msg,
    message: msg,
  });
};
