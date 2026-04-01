// server.js
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import { OAuth2Client } from "google-auth-library";

const PORT = process.env.PORT || 8080;

// TODO: replace with your real Google Client ID
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";

// Load permissions from JSON
// { "email": "KSROC", "other@email": "KSNT" }
const PERMISSIONS = JSON.parse(fs.readFileSync("./permissions.json", "utf8"));

// In-memory chatrooms
const chatrooms = {
  KSROC: [],
  KSNT: []
};

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return payload.email;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

function broadcastToAll(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");

  // Send initial chat history
  ws.send(
    JSON.stringify({
      type: "init",
      chatrooms
    })
  );

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (e) {
      console.error("[WS] Bad JSON:", e);
      return;
    }

    // AUTH handshake from client
    if (data.type === "auth") {
      try {
        const email = await verifyIdToken(data.idToken);
        const allowedRoom = PERMISSIONS[email];

        if (!allowedRoom) {
          ws.send(
            JSON.stringify({
              type: "auth-denied",
              reason: "No admin access for this Gmail."
            })
          );
          console.log("[AUTH] Denied:", email);
          return;
        }

        ws._email = email;
        ws._allowedRoom = allowedRoom;

        ws.send(
          JSON.stringify({
            type: "auth-ok",
            email,
            allowedRoom
          })
        );

        console.log("[AUTH] OK:", email, "->", allowedRoom);
      } catch (err) {
        console.error("[AUTH] Error verifying token:", err);
        ws.send(
          JSON.stringify({
            type: "auth-denied",
            reason: "Token verification failed."
          })
        );
      }
      return;
    }

    // Require auth for chat/image
    if (data.type === "chat" || data.type === "image") {
      if (!ws._email || !ws._allowedRoom) {
        console.log("[AUTH] Unauthenticated client tried to send.");
        return;
      }

      // Enforce room restriction
      if (data.room !== ws._allowedRoom) {
        console.log(
          "[AUTH] User",
          ws._email,
          "tried to send to unauthorized room",
          data.room
        );
        return;
      }

      const entry = {
        type: data.type,
        room: data.room,
        time: data.time,
        text: data.text,
        image: data.image
      };

      if (!chatrooms[data.room]) chatrooms[data.room] = [];
      chatrooms[data.room].push(entry);

      broadcastToAll(entry);
      return;
    }
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});