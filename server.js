const WebSocket = require("ws");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Load permissions.json
// Example:
// { "nwstwisterman@gmail.com": "KSROC", "stephanieoddo36@gmail.com": "KSNT" }
const PERMISSIONS = JSON.parse(fs.readFileSync("./permissions.json", "utf8"));

// TODO: Replace with your real Google Client ID
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

let polygons = [];
let chatrooms = {
  KSROC: [],
  KSNT: []
};

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  console.log("Client connected");

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

      const entry = { id, polygon: data.polygon, timestamp };
      polygons.push(entry);

      broadcast({
        type: "polygon",
        id,
        polygon: data.polygon
      });

      setTimeout(() => {
        polygons = polygons.filter(p => p.id !== id);

        broadcast({
          type: "delete",
          id
        });

        console.log("Expired polygon:", id);
      }, 300000);

      return;
    }

    // ---------------------------
    // CHAT HANDLING (with room enforcement)
    // ---------------------------
    if (data.type === "chat") {
      const { room, time, text } = data;

      if (room !== ws._allowedRoom) {
        console.log("[AUTH] User tried to send to unauthorized room:", ws._email);
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
    // IMAGE HANDLING (with room enforcement)
    // ---------------------------
    if (data.type === "image") {
      const { room, time, image } = data;

      if (room !== ws._allowedRoom) {
        console.log("[AUTH] Unauthorized image send:", ws._email);
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