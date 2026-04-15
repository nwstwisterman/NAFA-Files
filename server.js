// server.js
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import { OAuth2Client } from "google-auth-library";

const PORT = process.env.PORT || 8080;

// TODO: replace with your real Google Client ID
const GOOGLE_CLIENT_ID = "489416813239-9vciekbchc1uvjpchkkbmibvekjno13f.apps.googleusercontent.com";

// Load permissions from JSON
// Example:
// { "nwstwisterman@gmail.com": "USA", "other@gmail.com": "MEXICO" }
const PERMISSIONS = JSON.parse(fs.readFileSync("./permissions.json", "utf8"));

// Updated chatrooms
const chatrooms = {
  USA: [],
  MEXICO: [],
  CANADA: []
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

    // ⭐ NEW: Incoming audio from HTML sender
    if (data.office && data.filename && data.audioBase64) {
      console.log("[AUDIO] Incoming audio from", data.office, data.filename);

      // Forward EXACTLY as-is to all clients (WinForms expects this shape)
      broadcastToAll({
        office: data.office,
        filename: data.filename,
        audioBase64: data.audioBase64
      });

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

      // Username required
      if (!data.username || data.username.trim() === "") {
        console.log("[AUTH] Missing username from", ws._email);
        return;
      }

      const entry = {
        type: data.type,
        room: data.room,
        time: data.time,
        username: data.username,
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