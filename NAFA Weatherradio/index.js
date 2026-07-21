const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const app = express();

// -------------------------------
// CONFIG
// -------------------------------
const STATIONS = ["WXL20", "WXK97", "KIG86"];
const HLS_TIME = 5;
const HLS_LIST_SIZE = 5;
const HLS_BITRATE = "64k";

// -------------------------------
// UTIL
// -------------------------------
function ensureDir(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

// -------------------------------
// ICECAST AUTHENTICATION
// -------------------------------
app.use((req, res, next) => {
  const auth = req.headers["authorization"];

  if (!auth) {
    res.set("WWW-Authenticate", 'Basic realm="Icecast"');
    return res.status(401).send("Authentication required");
  }

  const base64 = auth.split(" ")[1];
  const [user, pass] = Buffer.from(base64, "base64").toString().split(":");

  // Icecast requires username "source"
  if (user !== "source" || pass !== "1") {
    return res.status(403).send("Forbidden");
  }

  next();
});

// -------------------------------
// ICECAST-COMPATIBLE UPLOAD HANDLER
// -------------------------------
function createStation(name) {
  const streamDir = `streams/${name}`;
  ensureDir(streamDir);

  app.all(`/upload/${name}`, (req, res) => {
    console.log(`[${name}] Broadcaster connected`);

    // Send Icecast-style headers but DO NOT close the response
    res.set("Server", "Icecast");
    res.set("ice-audio-info", "bitrate=64");
    res.set("Content-Type", "text/plain");
    res.status(200);
    res.flushHeaders(); // <-- CRITICAL: keeps connection open

    // Spawn FFmpeg HLS pipeline
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-c:a", "aac",
      "-b:a", HLS_BITRATE,
      "-f", "hls",
      "-hls_time", String(HLS_TIME),
      "-hls_list_size", String(HLS_LIST_SIZE),
      "-hls_flags", "delete_segments",
      `${streamDir}/index.m3u8`
    ]);

    ffmpeg.stderr.on("data", d => {
      const msg = d.toString().trim();
      if (msg.length > 0) console.log(`[${name}] FFmpeg: ${msg}`);
    });

    ffmpeg.on("close", code => {
      console.log(`[${name}] FFmpeg exited with code ${code}`);
    });

    req.on("data", chunk => {
      ffmpeg.stdin.write(chunk);
    });

    req.on("end", () => {
      ffmpeg.stdin.end();
      console.log(`[${name}] Stream ended`);
    });
  });

  app.use(`/${name}`, express.static(streamDir));
}

// -------------------------------
// INIT ALL STATIONS
// -------------------------------
STATIONS.forEach(createStation);

// -------------------------------
// ROOT STATUS ENDPOINT
// -------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    stations: STATIONS.map(name => ({
      name,
      hls: `/${name}/index.m3u8`,
      upload: `/upload/${name}`
    }))
  });
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Weather Radio HLS server running on port ${PORT}`);
  console.log(`Stations: ${STATIONS.join(", ")}`);
});
