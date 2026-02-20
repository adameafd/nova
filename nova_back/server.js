require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("user:join", (userId) => {
    const uid = String(userId);
    socket.join(`user_${uid}`);
    onlineUsers.set(uid, socket.id);
    console.log(`User ${uid} joined room user_${uid}`);
  });

  socket.on("message:send", (msg) => {
    if (!msg?.destinataire_id) return;

    const destRoom = `user_${msg.destinataire_id}`;

    io.to(destRoom).emit("message:receive", msg);

    io.to(destRoom).emit("conversations:update");
    io.to(`user_${msg.expediteur_id}`).emit("conversations:update");
  });

  // Message modifié → notifier les deux parties
  socket.on("message:edit", (data) => {
    if (!data?.destinataire_id || !data?.expediteur_id) return;
    io.to(`user_${data.destinataire_id}`).emit("message:edited", data);
    io.to(`user_${data.expediteur_id}`).emit("message:edited", data);
  });

  // Message supprimé → notifier les deux parties
  socket.on("message:delete", (data) => {
    if (!data?.destinataire_id || !data?.expediteur_id) return;
    io.to(`user_${data.destinataire_id}`).emit("message:deleted", data);
    io.to(`user_${data.expediteur_id}`).emit("message:deleted", data);
  });

  // Notification → envoyer au destinataire en temps réel
  socket.on("notification:send", (data) => {
    if (!data?.user_id) return;
    io.to(`user_${data.user_id}`).emit("notification:new", data);
  });

  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Messages routes loaded on /api/messages (GET, POST, PUT /:id, DELETE /:id)");
  console.log(`Server NOVA running on http://localhost:${PORT}`);
});
