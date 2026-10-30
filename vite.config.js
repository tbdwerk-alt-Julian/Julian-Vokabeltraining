import { defineConfig } from 'vite';
import fs from 'node:fs';

// Dev-Hilfen:
// - /__fps: das Spiel meldet seine Bildrate, der Server schreibt perf.log
// - /__save: Spielstände (3 Slots) + Vokabeln werden zusätzlich in saves/spielstand.json gesichert,
//   damit nichts verloren geht, wenn der Browser seinen Speicher leert.
function devEndpoints() {
  const FILE = 'saves/spielstand.json';
  const readBody = (req) => new Promise(res => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => res(b)); });
  const readStore = () => { try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d && d.save && !d.slots) return { slots: { 1: d.save }, vocabRaw: d.vocabRaw || null }; return d && d.slots ? d : { slots: {}, vocabRaw: null }; } catch (e) { return { slots: {}, vocabRaw: null }; } };
  const writeStore = (d) => { fs.mkdirSync('saves', { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); };
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
        const url = new URL(req.url, 'http://x');
        if (req.method === 'POST') {
          const body = await readBody(req); const store = readStore();
          try {
            const del = url.searchParams.get('del');
            if (del) { delete store.slots[del]; }
            else { const d = JSON.parse(body || '{}'); const slot = String(d.slot || 1); if (d.save) store.slots[slot] = d.save; if (d.vocabRaw) store.vocabRaw = d.vocabRaw; }
            writeStore(store); res.end('{"ok":true}');
          } catch (e) { res.statusCode = 500; res.end('{"ok":false}'); }
        } else res.end(JSON.stringify(readStore()));
      });
    }
  };
}

const BUILD = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function versionFile() { return { name: 'vocabquest-version-file', closeBundle() { try { fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/version.json', JSON.stringify({ build: BUILD })); } catch (e) { } } }; }
export default defineConfig({ base: './', define: { __BUILD__: JSON.stringify(BUILD) }, plugins: [devEndpoints(), versionFile()], server: { host: true, port: 5173 } });
