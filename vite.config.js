import { defineConfig } from 'vite';
import fs from 'node:fs';

// Dev-Hilfen:
// - /__fps: das Spiel meldet seine Bildrate, der Server schreibt perf.log
// - /__save: Spielstand + Vokabeln werden zusätzlich in saves/spielstand.json gesichert,
//   damit nichts verloren geht, wenn der Browser seinen Speicher leert.
function devEndpoints() {
  const readBody = (req) => new Promise(res => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => res(b)); });
  return {
    name: 'vocabquest-dev-endpoints',
    configureServer(server) {
      server.middlewares.use('/__fps', async (req, res) => {
        const body = await readBody(req);
        try { fs.appendFileSync('perf.log', new Date().toISOString() + ' ' + body.replace(/\s+/g, ' ') + '\n'); } catch (e) { }
        res.statusCode = 204; res.end();
      });
      server.middlewares.use('/__save', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'POST') {
          const body = await readBody(req);
          try { fs.mkdirSync('saves', { recursive: true }); fs.writeFileSync('saves/spielstand.json', body); res.end('{"ok":true}'); } catch (e) { res.statusCode = 500; res.end('{"ok":false}'); }
        } else {
          try { res.end(fs.readFileSync('saves/spielstand.json', 'utf8')); } catch (e) { res.statusCode = 404; res.end('null'); }
        }
      });
    }
  };
}

export default defineConfig({ plugins: [devEndpoints()], server: { host: true, port: 5173 } });
