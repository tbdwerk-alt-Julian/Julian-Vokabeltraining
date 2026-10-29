// Spielstände im Browser (localStorage), bis zu 3 benannte Slots. Speicherknopf + Autosave.
const KEY = 'vocabquest.save.v1';
export const SLOTS = 3;
const keyFor = (slot) => slot ? `${KEY}.${slot}` : KEY;
export function loadSave(slot) { try { const raw = localStorage.getItem(keyFor(slot)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
export function writeSave(data, slot) { try { data.savedAt = Date.now(); data.slot = slot; localStorage.setItem(keyFor(slot), JSON.stringify(data)); return true; } catch (e) { return false; } }
export function clearSave(slot) { try { localStorage.removeItem(keyFor(slot)); } catch (e) { } }
export function listSaves() { const out = []; for (let s = 1; s <= SLOTS; s++) out.push(loadSave(s)); return out; }
export function fmtTime(t) { return new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
