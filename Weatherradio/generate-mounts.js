const fs = require("fs");
const path = "./Streams";

const files = fs.readdirSync(path);

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(`${path}/${file}`));

  console.log(`
  <mount>
    <mount-name>/${data.mount}.mp3</mount-name>
    <password>${data.password}</password>
    <fallback-mount>/silence.mp3</fallback-mount>
  </mount>
  `);
});
