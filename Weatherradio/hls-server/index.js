const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const app = express();

const STATIONS = ["WXL20"];
const HLS_TIME = 5;
const HLS_LIST_SIZE = 5;
const HLS_BITRATE = "64k";

function ensureDir(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

app.all("/upload/:station", (req, res) => {
  const name = req.params.station;
  const streamDir = `streams/${name}`;
  ensureDir(streamDir);

  console.log(`[${name}] Broadcaster connected`);

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
    console.log(`[${name}] FFmpeg: ${d.toString().trim()}`);
  });

  req.on("data", chunk => ffmpeg.stdin.write(chunk));
  req.on("end", () => ffmpeg.stdin.end());

  res.status(200).end("OK");
});

app.use("/streams", express.static("streams"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HLS server running on port ${PORT}`);
});
