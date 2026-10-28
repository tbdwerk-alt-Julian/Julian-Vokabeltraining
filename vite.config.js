import { defineConfig } from 'vite';
import fs from 'node:fs';

// Dev-Hilfe: das Spiel schickt alle paar Sekunden seine Bildrate an /__fps,
// der Dev-Server schreibt sie nach perf.log (nur im Entwicklungsmodus).
function perfLog() {
  return {
    name: 'vocabquest-perf-log',
    configureServer(server) {
      server.middlewares.use('/__fps', (req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          try { fs.appendFileSync('perf.log', new Date().toISOString() + ' ' + body.replace(/\s+/g, ' ') + '\n'); } catch (e) { }
          res.statusCode = 204; res.end();
        });
      });
    }
  };
}

export default defineConfig({ plugins: [perfLog()], server: { host: true, port: 5173 } });
