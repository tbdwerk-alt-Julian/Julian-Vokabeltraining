// Vokabel-Speicher mit Sterne-System (Konzept Abschnitt 14):
// 1 Stern = einmal richtig · 2 = dreimal richtig an verschiedenen Tagen · 3 = fünfmal richtig, davon einmal nach über einer Woche Pause.
// Schwache Wörter kommen öfter dran. Alles liegt im Browser (localStorage).

const KEY = 'vocabquest.vocab.v1';
const DAY = 86400000;

export const SEED = [
  ['der Wald', 'forest'], ['gefährlich', 'dangerous'], ['die Umwelt', 'environment'], ['verantwortlich', 'responsible'],
  ['die Erfahrung', 'experience'], ['entscheiden', 'decide'], ['die Zukunft', 'future'], ['erfolgreich', 'successful'],
  ['der Nachbar', 'neighbour'], ['verbessern', 'improve'], ['die Freiheit', 'freedom'], ['überraschend', 'surprising'],
  ['die Gesellschaft', 'society'], ['die Regierung', 'government'], ['die Meinung', 'opinion'], ['vorschlagen', 'suggest'],
  ['die Möglichkeit', 'opportunity'], ['vermeiden', 'avoid'], ['der Vorteil', 'advantage'], ['der Nachteil', 'disadvantage'],
  ['die Verantwortung', 'responsibility'], ['die Wissenschaft', 'science'], ['die Erfindung', 'invention'], ['entwickeln', 'develop'],
  ['die Bevölkerung', 'population'], ['das Jahrhundert', 'century'], ['die Bedeutung', 'meaning'], ['die Beziehung', 'relationship'],
  ['sich beschweren', 'complain'], ['überzeugen', 'convince'], ['die Werbung', 'advertisement'], ['der Zweck', 'purpose'],
  ['die Nachrichten', 'news'], ['die Herausforderung', 'challenge'], ['unterstützen', 'support'], ['der Unterschied', 'difference'],
  ['die Gewohnheit', 'habit'], ['vertrauen', 'trust'], ['die Sicherheit', 'safety'], ['die Erinnerung', 'memory']
].map(([de, en], i) => ({ de, en, unit: 'Beispiel-Unit', ex: '' }));

let words = [];
let nextId = 1;

function today() { return Math.floor(Date.now() / DAY); }

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); words = d.words || []; nextId = d.nextId || (words.length + 1); } } catch (e) { words = []; }
  if (!words.length) { SEED.forEach(w => add(w.de, w.en, w.unit, w.ex, true)); save(); }
  return words;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify({ words, nextId })); } catch (e) { /* privater Modus o. ä. */ } }
export function all() { return words; }
export function units() { return [...new Set(words.map(w => w.unit))]; }
export function byUnit(u) { return words.filter(w => !u || w.unit === u); }

export function add(de, en, unit, ex, silent) {
  de = (de || '').trim(); en = (en || '').trim(); unit = (unit || 'Unit 1').trim(); ex = (ex || '').trim();
  if (!de || !en) return null;
  const dup = words.find(w => w.de.toLowerCase() === de.toLowerCase() && w.en.toLowerCase() === en.toLowerCase());
  if (dup) return dup;
  const w = { id: nextId++, de, en, unit, ex, seen: false, correct: 0, wrong: 0, days: [], lastDay: null, stars: 0, created: today() };
  words.push(w); if (!silent) save(); return w;
}
export function update(id, patch) { const w = words.find(x => x.id === id); if (w) { Object.assign(w, patch); save(); } return w; }
export function remove(id) { words = words.filter(w => w.id !== id); save(); }
export function removeUnit(u) { words = words.filter(w => w.unit !== u); save(); }

// Zeilen wie "der Hund - dog", "der Hund = dog", "der Hund; dog", "der Hund<TAB>dog", "der Hund: dog"
export function parseList(text) {
  const out = [];
  text.split(/\r?\n/).forEach(line => {
    line = line.trim(); if (!line) return;
    const m = line.split(/\s*(?:\t|;|=|:| - | – | — |\|)\s*/);
    if (m.length >= 2 && m[0] && m[1]) out.push({ de: m[0].trim(), en: m[1].trim(), ex: (m[2] || '').trim() });
  });
  return out;
}
export function importList(text, unit) { const list = parseList(text); let n = 0; list.forEach(w => { if (add(w.de, w.en, unit, w.ex, true)) n++; }); save(); return n; }

// Ergebnis eintragen → Sterne neu berechnen
export function record(id, ok) {
  const w = words.find(x => x.id === id); if (!w) return;
  const t = today(); w.seen = true;
  if (ok) {
    w.correct++;
    const pauseOk = w.lastDay !== null && t - w.lastDay > 7;
    if (!w.days.includes(t)) w.days.push(t);
    if (pauseOk) w.pauseHit = true;
    w.lastDay = t;
    const distinctDays = w.days.length;
    if (w.correct >= 5 && w.pauseHit) w.stars = 3;
    else if (w.correct >= 3 && distinctDays >= 3) w.stars = Math.max(w.stars, 2);
    else if (w.correct >= 1) w.stars = Math.max(w.stars, 1);
    // Vorschau/Alltag: 3 Sterne auch ohne Wochenpause ab 8 Treffern an 4 Tagen
    if (w.correct >= 8 && distinctDays >= 4) w.stars = 3;
  } else {
    w.wrong++; w.lastDay = t; if (w.stars > 0) w.stars--; w.pauseHit = false;
  }
  save();
}

// Gewichtete Auswahl: schwache und neue Wörter häufiger, 3-Sterne-Wörter selten
function weight(w) { const base = [8, 5, 2.5, .6][w.stars] || 1; const miss = 1 + Math.min(3, w.wrong) * .5; const fresh = w.seen ? 1 : 1.3; return base * miss * fresh; }
export function pick(n, unit, onlyWeak) {
  let pool = byUnit(unit); if (onlyWeak) pool = pool.filter(w => w.stars < 3); if (!pool.length) pool = words.slice();
  const out = [], used = new Set();
  for (let k = 0; k < n && used.size < pool.length; k++) {
    const cand = pool.filter(w => !used.has(w.id)); const total = cand.reduce((s, w) => s + weight(w), 0); let r = Math.random() * total;
    for (const w of cand) { r -= weight(w); if (r <= 0) { out.push(w); used.add(w.id); break; } }
    if (out.length < k + 1) { const w = cand[0]; out.push(w); used.add(w.id); }
  }
  return out;
}
export function stats(unit) { const l = byUnit(unit); const s = [0, 0, 0, 0]; l.forEach(w => s[w.stars]++); return { total: l.length, stars: s, unseen: l.filter(w => !w.seen).length }; }
export function exportText() { return words.map(w => `${w.de} - ${w.en}${w.ex ? ' - ' + w.ex : ''}`).join('\n'); }
