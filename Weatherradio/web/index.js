const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

function loadStations() {
  const dir = path.join(__dirname, "..", "Streams");
  if (!fs.existsSync(dir)) return {};

  const files = fs.readdirSync(dir);
  const stations = {};

  for (const file of files) {
    if (file.endsWith(".json")) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file)));
      stations[data.mountpoint.toUpperCase()] = data;
    }
  }

  return stations;
}

const stations = loadStations();

app.get("/:station", (req, res) => {
  const station = req.params.station.toUpperCase();

  if (!stations[station]) {
    return res.status(404).send("Station not found");
  }

  const data = stations[station];
  const streamUrl = `http://icecast.onrender.com:8000/${data.mountpoint}`;

  res.send(`
    <html>
      <head>
        <title>${data.name}</title>
        <style>
          body {
            background: #000;
            color: #fff;
            font-family: Arial, sans-serif;
            text-align: center;
            padding-top: 80px;
          }
          audio {
            width: 80%;
            max-width: 600px;
          }
        </style>
      </head>
      <body>
        <h1>${data.name}</h1>
        <audio controls autoplay>
          <source src="${streamUrl}" type="audio/mpeg">
        </audio>
      </body>
    </html>
  `);
});

app.get("/", (req, res) => {
  const list = Object.values(stations)
    .map(
      s =>
        `<li><a href="/${s.mountpoint}">${s.name} (${s.location})</a></li>`
    )
    .join("");

  res.send(`
    <html>
      <head>
        <title>Weather Radio Streams</title>
        <style>
          body { background:#000; color:#fff; font-family:Arial; padding:40px; }
          a { color:#0af; text-decoration:none; }
        </style>
      </head>
      <body>
        <h1>Weather Radio Streams</h1>
        <ul>${list}</ul>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});
