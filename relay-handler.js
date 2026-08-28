const { spawn } = require('child_process');

function attachRelay(ws) {
  let ff = null;
  let closing = false;

  const stop = () => {
    if (ff) {
      try { ff.stdin.end(); } catch (e) {}
      try { ff.kill('SIGKILL'); } catch (e) {}
      ff = null;
    }
  };

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (ff && ff.stdin.writable) ff.stdin.write(Buffer.from(data));
      return;
    }
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }

    if (msg.type === 'start') {
      stop();
      const d = msg.dest || {};
      if (!d.rtmp_url || !d.stream_key) {
        ws.send(JSON.stringify({ type: 'error', error: 'missing YouTube RTMP destination' }));
        return;
      }
      const rtmp = d.rtmp_url.replace(/\/$/, '') + '/' + d.stream_key;
      ff = spawn('ffmpeg', [
        '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p', '-g', '30', '-r', '30',
        '-c:a', 'aac', '-ar', '44100', '-b:a', '128k',
        '-fflags', '+genpts',
        '-f', 'flv', rtmp,
      ]);
      ff.stderr.on('data', (d) => process.stderr.write(`[ffmpeg] ${d}`));
      ff.on('error', (err) => { process.stderr.write(`ffmpeg error: ${err.message}\n`); ff = null; });
      ff.on('close', () => { ff = null; if (!closing) { try { ws.send(JSON.stringify({ type: 'ended' })); } catch (e) {} } });
      ws.send(JSON.stringify({ type: 'started' }));
    } else if (msg.type === 'end') {
      stop();
    }
  });

  ws.on('close', () => { closing = true; stop(); });
  ws.on('error', () => { closing = true; stop(); });
}

module.exports = { attachRelay };
