const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

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

  ws.on("message", msg => {
    const data = JSON.parse(msg);

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

    if (data.type === "chat") {
      const { room, time, text } = data;

      if (!chatrooms[room]) return;

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
  });
});

console.log("WebSocket server running on port", PORT);