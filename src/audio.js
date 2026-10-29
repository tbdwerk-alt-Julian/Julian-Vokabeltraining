// Sound: alles synthetisch über Web Audio (keine Dateien nötig) – Musik, Ambiente, Effekte.
let ctx = null, master, musicGain, sfxGain, ambGain, rainGain, windGain, started = false;
let vol = { music: .7, sfx: .8 };
let mode = 'calm', nightMix = 0, stepT = 0, birdT = 2, cricketT = 0, musicTimer = null, nextChord = 0, chordIdx = 0, beatT = 0;

function makeNoise(sec, brown) {
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return buf;
}
let noiseBuf = null, brownBuf = null;

export function init() {
  if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  musicGain = ctx.createGain(); sfxGain = ctx.createGain(); ambGain = ctx.createGain();
  musicGain.connect(master); sfxGain.connect(master); ambGain.connect(master);
  musicGain.gain.value = vol.music * .5; sfxGain.gain.value = vol.sfx; ambGain.gain.value = vol.sfx * .9;
  noiseBuf = makeNoise(2, false); brownBuf = makeNoise(3, true);
  startAmbient(); started = true;
}
export function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setVolumes(m, s) { vol.music = m; vol.sfx = s; if (!ctx) return; musicGain.gain.setTargetAtTime(m * .5, ctx.currentTime, .05); sfxGain.gain.setTargetAtTime(s, ctx.currentTime, .05); ambGain.gain.setTargetAtTime(s * .9, ctx.currentTime, .05); }

// ---------- Hilfsfunktionen ----------
function tone(freq, type, dur, g, dest, opts = {}) {
  const t = ctx.currentTime + (opts.delay || 0); const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + (opts.attack || .005)); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  let node = o; if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
  node.connect(gn); gn.connect(dest || sfxGain); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, g, dest, opts = {}) {
  const t = ctx.currentTime + (opts.delay || 0); const s = ctx.createBufferSource(); s.buffer = opts.brown ? brownBuf : noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = opts.type || 'bandpass'; f.frequency.setValueAtTime(opts.freq || 1000, t); if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur); f.Q.value = opts.q || .8;
  const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + (opts.attack || .005)); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(gn); gn.connect(dest || sfxGain); s.start(t); s.stop(t + dur + .05);
}

// ---------- Effekte ----------
export function sfx(name, opt = {}) {
  if (!ctx || ctx.state !== 'running') return;
  switch (name) {
    case 'step': noise(.07, .18, null, { freq: 700 + Math.random() * 300, q: .7 }); break;
    case 'hoof': noise(.06, .22, null, { freq: 300, type: 'lowpass' }); tone(110, 'sine', .08, .12, null, { to: 60 }); break;
    case 'swing': noise(.16, .28, null, { freq: 2400, to: 500, q: 1.2 }); break;
    case 'hit': noise(.12, .5, null, { freq: 900, to: 200 }); tone(160, 'sine', .18, .45, null, { to: 55 }); break;
    case 'crit': noise(.14, .55, null, { freq: 1200, to: 220 }); tone(170, 'sine', .22, .5, null, { to: 50 }); tone(880, 'sine', .25, .18, null, { delay: .04 }); tone(1320, 'sine', .3, .14, null, { delay: .08 }); break;
    case 'hurt': tone(190, 'sawtooth', .22, .25, null, { to: 80, lp: 900 }); noise(.15, .3, null, { freq: 400, to: 120 }); break;
    case 'wrong': tone(440, 'triangle', .16, .22); tone(330, 'triangle', .22, .22, null, { delay: .15 }); break;
    case 'coin': tone(1200, 'sine', .09, .22); tone(1600, 'sine', .14, .22, null, { delay: .08 }); break;
    case 'gem': tone(1760, 'sine', .12, .18); tone(2217, 'sine', .18, .16, null, { delay: .09 }); tone(2637, 'sine', .25, .14, null, { delay: .18 }); break;
    case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 'triangle', .35, .22, null, { delay: i * .11 })); break;
    case 'click': tone(1800, 'square', .03, .06); break;
    case 'chest': tone(200, 'sawtooth', .35, .12, null, { to: 330, lp: 700 }); tone(1200, 'sine', .09, .2, null, { delay: .35 }); tone(1600, 'sine', .14, .2, null, { delay: .43 }); break;
    case 'thunder': noise(1.8 + Math.random(), .9, null, { brown: true, type: 'lowpass', freq: 220, attack: .02, delay: opt.delay || 0 }); break;
    case 'quest': tone(880, 'sine', .18, .18); tone(1108, 'sine', .3, .18, null, { delay: .12 }); break;
    case 'dodge': noise(.22, .25, null, { freq: 600, to: 1600 }); break;
    case 'splash': noise(.3, .3, null, { freq: 1500, to: 400, q: .5 }); break;
    case 'mount': noise(.14, .2, null, { freq: 500, type: 'lowpass' }); tone(90, 'sine', .14, .15, null, { to: 50 }); break;
    case 'open': tone(600, 'sine', .08, .12, null, { to: 900 }); break;
    case 'close': tone(900, 'sine', .08, .12, null, { to: 600 }); break;
    case 'torch': noise(.5, .25, null, { freq: 1200, to: 500, attack: .05 }); break;
  }
}

// ---------- Ambiente: Wind, Regen (Dauerquellen), Vögel/Grillen (geplant) ----------
function startAmbient() {
  const wind = ctx.createBufferSource(); wind.buffer = brownBuf; wind.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 320; windGain = ctx.createGain(); windGain.gain.value = .06; wind.connect(wf); wf.connect(windGain); windGain.connect(ambGain); wind.start();
  const lfo = ctx.createOscillator(); lfo.frequency.value = .11; const lg = ctx.createGain(); lg.gain.value = .035; lfo.connect(lg); lg.connect(windGain.gain); lfo.start();
  const rain = ctx.createBufferSource(); rain.buffer = noiseBuf; rain.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 2200; rf.Q.value = .4; rainGain = ctx.createGain(); rainGain.gain.value = 0; rain.connect(rf); rf.connect(rainGain); rainGain.connect(ambGain); rain.start();
  startMusic();
}
function bird() { const base = 1800 + Math.random() * 1400; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(base * (1 + Math.random() * .3), 'sine', .09, .05, ambGain, { to: base * 1.25, delay: i * .13 }); }
function cricket() { for (let i = 0; i < 6; i++) tone(4300 + Math.random() * 300, 'sine', .018, .025, ambGain, { delay: i * .07 }); }

// ---------- Musik: Pad-Akkorde + leises Arpeggio; im Kampf schneller und dunkler ----------
const CALM = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
const NIGHT = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]];
const FIGHT = [[220, 261.6, 329.6], [146.8, 174.6, 220], [164.8, 207.7, 246.9], [220, 261.6, 329.6]];
function startMusic() { if (musicTimer) return; nextChord = ctx.currentTime + .2; musicTimer = setInterval(scheduleMusic, 200); }
function scheduleMusic() {
  if (!ctx || ctx.state !== 'running') return; const now = ctx.currentTime; const chords = mode === 'battle' ? FIGHT : nightMix > .5 ? NIGHT : CALM; const len = mode === 'battle' ? 2.2 : 4.2;
  while (nextChord < now + .6) {
    const ch = chords[chordIdx % chords.length]; const t = nextChord;
    ch.forEach(f => { for (const det of [-5, 5]) { const o = ctx.createOscillator(); o.type = mode === 'battle' ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = det; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = mode === 'battle' ? 700 : 520; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(mode === 'battle' ? .05 : .07, t + len * .3); g.gain.linearRampToValueAtTime(0, t + len * 1.05); o.connect(fl); fl.connect(g); g.connect(musicGain); o.start(t); o.stop(t + len * 1.1); } });
    const steps = mode === 'battle' ? 8 : 8; for (let i = 0; i < steps; i++) { const f = ch[i % 3] * (i >= 4 ? 2 : 1) * (mode === 'battle' ? 1 : 2); tone(f, 'sine', .35, mode === 'battle' ? .05 : .045, musicGain, { delay: t - now + i * len / steps, attack: .01 }); }
    if (mode === 'battle') for (let i = 0; i < 4; i++) { tone(60, 'sine', .22, .32, musicGain, { to: 35, delay: t - now + i * len / 4 }); noise(.08, .12, musicGain, { freq: 3000, delay: t - now + i * len / 4 + len / 8 }); }
    nextChord += len; chordIdx++;
  }
}
export function setMode(m) { mode = m; }

// Pro Frame: Schritte, Wetter, Tageszeit
export function tick(dt, s) {
  if (!ctx || ctx.state !== 'running') return;
  nightMix = s.night; if (s.battle && mode !== 'battle') mode = 'battle'; else if (!s.battle && mode === 'battle') mode = 'calm';
  if (rainGain) rainGain.gain.setTargetAtTime(s.rain * .35, ctx.currentTime, .5);
  if (windGain) windGain.gain.setTargetAtTime(.05 + s.wind * .12, ctx.currentTime, .5);
  if (s.moving && !s.swimming) { stepT -= dt; if (stepT <= 0) { sfx(s.mounted ? 'hoof' : 'step'); stepT = s.mounted ? .26 : .34; } } else stepT = .1;
  birdT -= dt; if (birdT <= 0) { if (s.night < .4 && s.rain < .2) bird(); birdT = 2 + Math.random() * 6; }
  cricketT -= dt; if (cricketT <= 0) { if (s.night > .5) cricket(); cricketT = 1.2 + Math.random() * 2.5; }
}

export function debug() { return { state: ctx ? ctx.state : "none", mode, nextChord: ctx ? +(nextChord - ctx.currentTime).toFixed(2) : null, chordIdx, started }; }
