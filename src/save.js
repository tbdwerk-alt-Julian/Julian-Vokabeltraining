// Spielstand im Browser (localStorage). Speicherknopf + Autosave.
const KEY = 'vocabquest.save.v1';
export function loadSave() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
export function writeSave(data) { try { data.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { } }
export function fmtTime(t) { return new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
