require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const db = require("./config/db");

const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173", "http://localhost"];

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// Expose io aux controllers (ex: telemetry → emit "telemetry_update")
app.locals.io = io;

// uid (string) → socketId
const onlineUsers = new Map();

// Met à jour le statut en DB (sans bloquer si la colonne a une contrainte ENUM incompatible)
async function setStatut(uid, statut) {
  try {
    await db.query(
      "UPDATE utilisateurs SET statut_activite = ? WHERE id = ?",
      [statut, uid]
    );
  } catch (err) {
    console.error(`[socket] DB statut update error (uid=${uid}):`, err.message);
  }
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ── Connexion utilisateur ─────────────────────────────────────────────
  socket.on("user:join", async (userId) => {
    const uid = String(userId);
    socket.join(`user_${uid}`);
    onlineUsers.set(uid, socket.id);

    // Mise à jour DB
    await setStatut(uid, "en_ligne");
    await db.query(
      "UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id = ?",
      [uid]
    ).catch(() => {});

    // Broadcast à TOUS les clients connectés
    io.emit("users:status_update", { userId: Number(uid), statut: "en_ligne" });

    console.log(`[socket] User ${uid} en_ligne`);
  });

  // ── Messages ──────────────────────────────────────────────────────────
  socket.on("message:send", (msg) => {
    if (!msg?.destinataire_id) return;
    const destRoom = `user_${msg.destinataire_id}`;
    io.to(destRoom).emit("message:receive", msg);
    io.to(destRoom).emit("conversations:update");
    io.to(`user_${msg.expediteur_id}`).emit("conversations:update");
  });

  socket.on("message:edit", (data) => {
    if (!data?.destinataire_id || !data?.expediteur_id) return;
    io.to(`user_${data.destinataire_id}`).emit("message:edited", data);
    io.to(`user_${data.expediteur_id}`).emit("message:edited", data);
  });

  socket.on("message:delete", (data) => {
    if (!data?.destinataire_id || !data?.expediteur_id) return;
    io.to(`user_${data.destinataire_id}`).emit("message:deleted", data);
    io.to(`user_${data.expediteur_id}`).emit("message:deleted", data);
  });

  // ── Notifications ─────────────────────────────────────────────────────
  socket.on("notification:send", (data) => {
    if (!data?.user_id) return;
    io.to(`user_${data.user_id}`).emit("notification:new", data);
  });

  // ── Déconnexion ───────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    let uid = null;
    for (const [id, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        uid = id;
        onlineUsers.delete(id);
        break;
      }
    }

    if (uid) {
      await setStatut(uid, "hors_ligne");

      // Broadcast à TOUS les clients connectés
      io.emit("users:status_update", { userId: Number(uid), statut: "hors_ligne" });

      console.log(`[socket] User ${uid} hors_ligne`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server NOVA running on http://localhost:${PORT}`);
});
