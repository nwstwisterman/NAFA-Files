const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const app = express();

function createStation(name) {
  if (!fs.existsSync(`streams/${name}`)) {
    fs.mkdirSync(`streams/${name}`, { recursive: true });
  }

  app.post(`/upload/${name}`, (req, res) => {
    console.log(`Broadcaster connected to ${name}`);

    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-c:a", "aac",
      "-b:a", "64k",
      "-f", "hls",
      "-hls_time", "5",
      "-hls_list_size", "5",
      "-hls_flags", "delete_segments",
      `streams/${name}/index.m3u8`
    ]);

    // Accept ANY incoming audio stream (Icecast, Shoutcast, raw MP3)
    req.on("data", chunk => {
      ffmpeg.stdin.write(chunk);
    });

    req.on("end", () => {
      ffmpeg.stdin.end();
      console.log(`${name} stream ended`);
    });

    ffmpeg.stderr.on("data", d => console.log("FFmpeg:", d.toString()));

    res.end("OK");
  });

  app.use(`/${name}`, express.static(`streams/${name}`));
}

createStation("WXL20");
createStation("WXK97");
createStation("KIG86");

app.listen(3000, () => console.log("Weather Radio HLS server running"));
