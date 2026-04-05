const WebSocket = require("ws");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Load permissions.json
// Example:
// { "nwstwisterman@gmail.com": "KSROC", "stephanieoddo36@gmail.com": "KSNT" }
const PERMISSIONS = JSON.parse(fs.readFileSync("./permissions.json", "utf8"));

// Your Google OAuth Client ID
const GOOGLE_CLIENT_ID = "489416813239-9vciekbchc1uvjpchkkbmibvekjno13f.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return payload.email;
}

// Store polygons + chatrooms
let polygons = []; // { id, polygon, timestamp }
let chatrooms = {
  KSROC: [],
  KSNT: []
};

// Broadcast helper
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  console.log("Client connected");

  // Send initial state
  ws.send(JSON.stringify({
    type: "init",
    polygons,
    chatrooms
  }));

  ws.on("message", async msg => {
    const data = JSON.parse(msg);

    // ---------------------------
    // AUTH HANDSHAKE
    // ---------------------------
    if (data.type === "auth") {
      try {
        const email = await verifyIdToken(data.idToken);
        const allowedRoom = PERMISSIONS[email];

        if (!allowedRoom) {
          ws.send(JSON.stringify({
            type: "auth-denied",
            reason: "Unauthorized Gmail account."
          }));
          console.log("[AUTH] Denied:", email);
          return;
        }

        ws._email = email;
        ws._allowedRoom = allowedRoom;

        ws.send(JSON.stringify({
          type: "auth-ok",
          email,
          allowedRoom
        }));

        console.log("[AUTH] OK:", email, "->", allowedRoom);
      } catch (err) {
        console.error("[AUTH] Token error:", err);
        ws.send(JSON.stringify({
          type: "auth-denied",
          reason: "Token verification failed."
        }));
      }
      return;
    }

    // ---------------------------
    // REQUIRE AUTH FOR EVERYTHING ELSE
    // ---------------------------
    if (!ws._email || !ws._allowedRoom) {
      console.log("[AUTH] Unauthenticated client attempted action.");
      return;
    }

    // ---------------------------
    // POLYGON HANDLING
    // ---------------------------
    if (data.type === "polygon") {
      const id = "poly-" + Math.random().toString(36).substring(2, 10);
      const timestamp = Date.now();

      // Accept both formats: polygon or vertices
      const poly = data.polygon || data.vertices;

      if (!poly) {
        console.log("Received polygon with no vertices");
        return;
      }

      const entry = { id, polygon: poly, timestamp };
      polygons.push(entry);

      // Broadcast to all clients
      broadcast({
        type: "polygon",
        id,
        polygon: poly
      });

      // Auto-delete after 30 minutes
      setTimeout(() => {
        polygons = polygons.filter(p => p.id !== id);

        broadcast({
          type: "delete",
          id
        });

        console.log("Expired polygon:", id);
      }, 1800000); // 30 minutes

      return;
    }

    // ---------------------------
    // CHAT HANDLING
    // ---------------------------
    if (data.type === "chat") {
      const { room, time, text } = data;

      if (room !== ws._allowedRoom) {
        console.log("[AUTH] Unauthorized chat:", ws._email);
        return;
      }

      chatrooms[room].push({ room, time, text });

      broadcast({
        type: "chat",
        room,
        time,
        text
      });

      console.log(`Chat → ${room}: ${text}`);
      return;
    }

    // ---------------------------
    // IMAGE HANDLING
    // ---------------------------
    if (data.type === "image") {
      const { room, time, image } = data;

      if (room !== ws._allowedRoom) {
        console.log("[AUTH] Unauthorized image:", ws._email);
        return;
      }

      chatrooms[room].push({ room, time, image });

      broadcast({
        type: "image",
        room,
        time,
        image
      });

      console.log(`Image → ${room}`);
      return;
    }
  });
});

console.log("WebSocket server running on port", PORT);
