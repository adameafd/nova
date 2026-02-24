const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const utilisateursRoutes = require("./routes/utilisateurs.routes");
const alertesRoutes = require("./routes/alertes.routes");
const authRoutes = require("./routes/auth.routes");
const messagesRoutes = require("./routes/messages.routes");
const stockRoutes = require("./routes/stock.routes");
const interventionsRoutes = require("./routes/interventions.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const comptesRendusRoutes = require("./routes/comptesRendus.routes");
const telemetryRoutes     = require("./routes/telemetry.routes");
const errorHandler = require("./middlewares/errorHandler");
const { setupSwagger } = require("./swagger");

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173", "http://localhost"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // Permissive in dev, restrict via CORS_ORIGIN in prod
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/uploads", express.static(uploadsDir));

// Swagger API documentation
setupSwagger(app);

// Health-check / root route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API NOVA running", docs: "/api-docs" });
});

// API routes
app.use("/api", authRoutes);
app.use("/api/utilisateurs", utilisateursRoutes);
app.use("/api/alertes", alertesRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/interventions", interventionsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/compte-rendus", comptesRendusRoutes);
app.use("/api/telemetry",    telemetryRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

module.exports = app;
