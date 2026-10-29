import * as THREE from 'three';
import { loadModel, instance, size as modelSize } from './assets.js';
import * as V from './vocab.js';
import { loadSave, writeSave, clearSave, fmtTime, listSaves, SLOTS } from './save.js';
import { setupGraphics, weatherize, makeNormalTex, WORLD_U } from './graphics.js';
import * as A from './audio.js';

(function () {
  const $ = id => document.getElementById(id);
  const rng = (a, b) => a + Math.random() * (b - a);
  const anims = new Set(); let heroInst = null, invInst = null; // animierte GLTF-Instanzen
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Spielzustand ----------
  const state = { level: 1, xp: 0, xpNeed: 100, hp: 100, maxHp: 100, hearts: 5, maxHearts: 5, coins: 0, gems: 0, stamina: 100, air: 100, mounted: true, charIdx: 0, name: 'Held', hot: 0, quests: { wolves: 0, chest: false, accepted: {} }, wolvesKilled: 0 };
  const settings = { sens: 1, camDist: 8.5, joy: 120, invert: 0, quality: 2, fps: 0, showFps: 0 };
  const DEF_STATS = () => ({ battles: 0, trolls: 0, chests: 0, stations: 0, words: 0, crits: 0, bestCombo: 0, playSecs: 0, coinsEarned: 0 });
  const ensureState = () => { if (!state.stats) state.stats = DEF_STATS(); for (const k in DEF_STATS()) if (state.stats[k] === undefined) state.stats[k] = 0; if (!state.buffs) state.buffs = { shield: 0, fire: 0, str: 0, luck: 0 }; if (!state.daily) state.daily = { day: -1, offers: [], chosen: null, base: 0, done: false }; };
  ensureState();
  const prefs = { kurs: 'E', modus: 'S', tier: 'horse' };
  const CHARS = [
    { name: 'Kai', hair: 0x2a1a12, cloth: 0x2d6fd6, cloth2: 0x1f2a44, cape: 0x8b1f3a, style: 'spiky' },
    { name: 'Lena', hair: 0xf0d070, cloth: 0x7a4fd6, cloth2: 0x2a2440, cape: 0x1f8a4c, style: 'pony' },
    { name: 'Ryo', hair: 0xcfd6e2, cloth: 0x1b1b22, cloth2: 0x2b2b33, cape: 0xd9a52a, style: 'long' }
  ];

  // ---------- Renderer & Szene ----------
  const stage = $('stage');
  const setLoad = (t) => { const el = $('loadText'); if (el) el.textContent = t; };
  setLoad('Grafik wird gestartet …');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x7fa6bd, 0.0042);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .9, metalness: 0, flatShading: true }, o));
  const smooth = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .75, metalness: 0 }, o));
  const clock = { t: 0 };
  const WORLD = 720, HALF = WORLD / 2 - 6;

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3b5a2a, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe9c4, 2.1); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = .02; sun.shadow.radius = 2;
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 220 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun); scene.add(sun.target);
  // Himmel, Tageszeit, Nachbearbeitung, ferne Berge
  const gfx = setupGraphics({ renderer, scene, camera, sun, hemi, stage }); const skyMesh = gfx.skyMesh;

  // ---------- Gelände ----------
  const LAKE = { x: 70, z: 80, r: 48 }, RIVER_X = -40, WATER_Y = 0.3;
  function groundY(x, z) {
    let y = 1.2 + Math.sin(x * .05) * Math.cos(z * .04) * 1.1 + Math.sin(x * .18) * Math.cos(z * .15) * .35 + Math.sin(x * .6 + z * .4) * .08;
    const d = Math.hypot(x - LAKE.x, z - LAKE.z); if (d < LAKE.r) y -= 5 * (1 - (d / LAKE.r) ** 2);
    const rd = Math.abs(x - RIVER_X); if (rd < 7) y -= 2.4 * (1 - (rd / 7) ** 2);
    const c = Math.hypot(x, z); if (c < 16) y = y * clamp((c - 8) / 8, 0, 1) + 1.2 * (1 - clamp((c - 8) / 8, 0, 1));
    // Berge: Gebirgsring am Kartenrand + drei Hügelketten im Inneren
    if (c > 240) y += Math.pow((c - 240) / 70, 2) * 32 + Math.sin(x * .07) * Math.cos(z * .06) * Math.min(12, (c - 240) * .2);
    y += 16 * Math.exp(-(((x - 190) ** 2) + ((z + 150) ** 2)) / 4200) + 13 * Math.exp(-(((x + 210) ** 2) + ((z - 90) ** 2)) / 5200) + 22 * Math.exp(-(((x - 40) ** 2) + ((z - 250) ** 2)) / 6500) + 9 * Math.exp(-(((x + 120) ** 2) + ((z + 200) ** 2)) / 3000);
    // Nähere, höhere Gipfel – vom Lager aus sichtbar
    y += 34 * Math.exp(-(((x - 130) ** 2) + ((z + 95) ** 2)) / 2600) + 28 * Math.exp(-(((x + 150) ** 2) + ((z - 70) ** 2)) / 3000) + 38 * Math.exp(-(((x - 70) ** 2) + ((z - 175) ** 2)) / 3400) + 26 * Math.exp(-(((x + 90) ** 2) + ((z + 160) ** 2)) / 2400) + 20 * Math.exp(-(((x - 175) ** 2) + ((z - 60) ** 2)) / 2000);
    if (y > 6) y += Math.sin(x * .35) * Math.cos(z * .3) * Math.min(3, (y - 6) * .25); // Felsgrat-Struktur an den Hängen
    return y;
  }
  const TREELINE = 13;
  const inWater = (x, z) => groundY(x, z) < WATER_Y - .45;
  const groundGeo = new THREE.PlaneGeometry(WORLD, WORLD, 300, 300); groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position, gcol = [];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), y = groundY(x, z); gp.setY(i, y);
    const n = .5 + .5 * Math.sin(x * .9) * Math.cos(z * .7);
    let c = y < WATER_Y + .2 ? new THREE.Color(0xc9b98a) : new THREE.Color().setHSL(.3 - n * .04, .55, .28 + n * .1);
    if (y > 9) { const rockC = new THREE.Color().setHSL(.08, .08, .3 + n * .08); c = c.lerp(rockC, clamp((y - 9) / 5, 0, 1)); }
    if (y > 20) c = c.lerp(new THREE.Color(0xf2f6fa), clamp((y - 20) / 6, 0, 1));
    gcol.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3)); groundGeo.computeVertexNormals();
  // Prozedurale Boden-Textur (Gras mit Flecken und Erde)
  function makeGroundTex() {
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
    c.fillStyle = '#4f8a3c'; c.fillRect(0, 0, S, S);
    // großflächige Farbvariation
    for (let i = 0; i < 140; i++) { const g = c.createRadialGradient(Math.random() * S, Math.random() * S, 0, Math.random() * S, Math.random() * S, 80 + Math.random() * 160); const h = 85 + Math.random() * 40; g.addColorStop(0, `hsla(${h},${35 + Math.random() * 25}%,${26 + Math.random() * 16}%,.5)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S); }
    // Grasbüschel: kurze Striche
    for (let i = 0; i < 26000; i++) { const x = Math.random() * S, y = Math.random() * S, h = 95 + Math.random() * 35, l = 24 + Math.random() * 26; c.strokeStyle = `hsla(${h},${40 + Math.random() * 30}%,${l}%,${.5 + Math.random() * .5})`; c.lineWidth = 1 + Math.random() * 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - .5) * 5, y - 3 - Math.random() * 7); c.stroke(); }
    // Erde, Steinchen, Klee
    for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(${80 + Math.random() * 40},${60 + Math.random() * 30},35,${.1 + Math.random() * .18})`; c.beginPath(); c.ellipse(Math.random() * S, Math.random() * S, 8 + Math.random() * 30, 5 + Math.random() * 16, Math.random() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 900; i++) { const g = 110 + Math.random() * 70; c.fillStyle = `rgba(${g},${g},${g - 10},${.35 + Math.random() * .4})`; c.beginPath(); c.ellipse(Math.random() * S, Math.random() * S, 1 + Math.random() * 2.2, 1 + Math.random() * 1.6, Math.random() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 1500; i++) { c.fillStyle = `hsla(${110 + Math.random() * 30},45%,${35 + Math.random() * 20}%,.7)`; c.beginPath(); c.arc(Math.random() * S, Math.random() * S, 1.2 + Math.random() * 1.8, 0, 7); c.fill(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  const groundNrm = makeNormalTex(512, 7, 3.2, 5); groundNrm.repeat.set(60, 60); groundNrm.anisotropy = 8;
  const ground = new THREE.Mesh(groundGeo, weatherize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, map: makeGroundTex(), normalMap: groundNrm, normalScale: new THREE.Vector2(.55, .55) }), { wetRough: .32 })); ground.receiveShadow = true; scene.add(ground);

  // Wasser (See + Fluss), leichte Wellen
  const waterGeo = new THREE.PlaneGeometry(WORLD, WORLD, 100, 100); waterGeo.rotateX(-Math.PI / 2);
  const wp = waterGeo.attributes.position, wcol = [];
  for (let i = 0; i < wp.count; i++) {
    const depth = WATER_Y - groundY(wp.getX(i), wp.getZ(i));
    const c = depth < .3 ? new THREE.Color(0x9fd0dc) : depth < 1.2 ? new THREE.Color(0x2f8fae) : depth < 3 ? new THREE.Color(0x176a94) : new THREE.Color(0x0b3454);
    wcol.push(c.r, c.g, c.b);
  }
  waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
  const waterNrm = makeNormalTex(256, 5, 2.6, 4); waterNrm.repeat.set(36, 36);
  const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .2, metalness: .1, transparent: true, opacity: .86, envMapIntensity: .3, normalMap: waterNrm, normalScale: new THREE.Vector2(.8, .8) });
  waterMat.onBeforeCompile = sh => { sh.uniforms.wt = { value: 0 }; waterMat.userData.wt = sh.uniforms.wt; sh.fragmentShader = 'uniform float wt;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `
    vec3 n1 = texture2D(normalMap, vUv + vec2(wt * .021, wt * .013)).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(normalMap, vUv * 1.9 - vec2(wt * .016, -wt * .012)).xyz * 2.0 - 1.0;
    vec3 mapN = normalize(vec3((n1.xy + n2.xy) * normalScale, n1.z + n2.z));
    normal = perturbNormal2Arb(-vViewPosition, normal, mapN, faceDirection);`); };
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_Y; scene.add(water);

  // Brücke über den Fluss
  // Rinden-Textur
  function makeBarkTex(base) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const c = cv.getContext('2d');
    c.fillStyle = base; c.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 900; i++) { const x = Math.random() * 256, y = Math.random() * 512, h = 10 + Math.random() * 60; c.fillStyle = `rgba(${20 + Math.random() * 30},${12 + Math.random() * 20},${6 + Math.random() * 10},${.25 + Math.random() * .4})`; c.fillRect(x, y, 1 + Math.random() * 3, h); }
    for (let i = 0; i < 300; i++) { const x = Math.random() * 256, y = Math.random() * 512, h = 6 + Math.random() * 30; c.fillStyle = `rgba(${150 + Math.random() * 50},${110 + Math.random() * 40},${70 + Math.random() * 30},${.15 + Math.random() * .25})`; c.fillRect(x, y, 1 + Math.random() * 2, h); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.encoding = THREE.sRGBEncoding; return t;
  }
  const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, map: makeBarkTex('#5a3b22') }), barkMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, map: makeBarkTex('#6e4a2b') });
  const treeShadowMat = new THREE.MeshBasicMaterial({ color: 0x0b2410, transparent: true, opacity: .2, depthWrite: false });
  (function () {
    const b = new THREE.Group(); const deck = new THREE.Mesh(new THREE.BoxGeometry(16, .3, 3.2), mat(0x8a5a33)); deck.position.y = 1.6; deck.castShadow = true; b.add(deck);
    for (const s of [-1.4, 1.4]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(16, .12, .12), barkMat2); rail.position.set(0, 2.4, s); b.add(rail); for (let i = -7; i <= 7; i += 2) { const p = new THREE.Mesh(new THREE.BoxGeometry(.14, .9, .14), barkMat2); p.position.set(i, 2, s); b.add(p); } }
    for (const x of [-5, 0, 5]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, 3, 7), barkMat); post.position.set(x, .3, 0); b.add(post); }
    b.position.set(RIVER_X, 0, 10); scene.add(b);
  })();
  const onBridge = (x, z) => Math.abs(x - RIVER_X) < 8 && Math.abs(z - 10) < 1.6;

  // Gras – wird um den Spieler herum neu verteilt
  // Grashalm: 4 Segmente, nach oben schmaler, leicht gebogen, unten dunkler
  // Grasbüschel: drei Halme je Instanz (um 120° gedreht), nach oben schmaler, leicht gebogen, unten dunkler
  const bladeGeo = (function () {
    const pos = [], col = [], idx = [], ROWS = 3, H = .8; let base = 0;
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), hh = H * (.75 + k * .15), off = .06;
      for (let r = 0; r <= ROWS; r++) { const t = r / ROWS, w = .06 * (1 - t * .8), y = t * hh, bend = t * t * .3; const px = -w * ca - (off + bend) * sa, pz = -w * sa + (off + bend) * ca, qx = w * ca - (off + bend) * sa, qz = w * sa + (off + bend) * ca; pos.push(px, y, pz, qx, y, qz); const sh = .4 + t * .6; col.push(sh * .9, sh, sh * .72, sh * .9, sh, sh * .72); }
      for (let r = 0; r < ROWS; r++) { const i0 = base + r * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
      base += (ROWS + 1) * 2;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const grassMat = weatherize(new THREE.MeshStandardMaterial({ color: 0x6db552, roughness: .9, side: THREE.DoubleSide, vertexColors: true }), { snowLow: -1, snowMax: .8 });
  grassMat.onBeforeCompile = sh => { sh.uniforms.t = { value: 0 }; sh.uniforms.uWind = { value: 0 }; grassMat.userData.u = sh.uniforms.t; grassMat.userData.w = sh.uniforms.uWind; sh.vertexShader = 'uniform float t; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float ph = instanceMatrix[3][0] * .6 + instanceMatrix[3][2] * .4; transformed.x += (sin(t * 1.8 + ph) * .18 + uWind * .35) * position.y; transformed.z += cos(t * 1.3 + ph) * .1 * position.y;'); };
  const GRASS = 9000, GR = 42;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS); grass.receiveShadow = true; scene.add(grass);
  const dummy = new THREE.Object3D(), gcolor = new THREE.Color();
  let grassCenter = { x: 1e9, z: 1e9 };
  function placeGrass(cx, cz) {
    grassCenter = { x: cx, z: cz };
    for (let i = 0; i < GRASS; i++) {
      let x, z, tries = 0;
      do { x = cx + rng(-GR, GR); z = cz + rng(-GR, GR); tries++; } while ((inWater(x, z) || Math.hypot(x - 3, z + 3) < 2.5) && tries < 4);
      const gyy = groundY(x, z); dummy.position.set(x, gyy, z); dummy.rotation.set(0, Math.random() * Math.PI, 0); dummy.scale.setScalar(gyy < WATER_Y - .45 || gyy > 18 ? 0 : .5 + Math.random() * .6);
      dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
      gcolor.setHSL(.26 + Math.random() * .08, .45 + Math.random() * .2, .3 + Math.random() * .18); grass.setColorAt(i, gcolor);
    }
    grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  }
  placeGrass(0, 0);

  // Bäume (realistischer: Stamm mit Ästen, viele Blätterballen, hellere Spitzen)
  // ===== Vegetation: instanziiert (ein Draw-Call pro Bauteil statt tausender Einzel-Meshes) =====
  const CAVE = { x: 36, z: -6, r: 17 };
  const HUTS = [[-62, -34], [118, 42], [-112, 112], [84, -124], [160, 150], [-170, -70], [20, 120], [-95, -150], [190, -30], [-200, 40]];
  const RUINS = [[-30, 150], [140, -60], [-150, -150], [200, 10], [40, -200], [-80, 60], [110, 120], [-230, -20]];
  const nearBuilding = (x, z, r) => HUTS.some(([a, b]) => Math.hypot(a - x, b - z) < r) || RUINS.some(([a, b]) => Math.hypot(a - x, b - z) < r + 3);
  const treeSpots = [], con = [], broad = [], bushes = [], rocks = [], flowers = [], shrooms = [], reeds = [], deadTrees = [], ferns = [], logs = [];
  for (let i = 0; i < 2600; i++) {
    const x = rng(-HALF, HALF), z = rng(-HALF, HALF); const gy = groundY(x, z);
    if (Math.hypot(x, z) < 24 || gy < WATER_Y - .45 || gy > TREELINE || Math.abs(x - RIVER_X) < 9 || nearBuilding(x, z, 8) || Math.hypot(x - CAVE.x, z - CAVE.z) < CAVE.r + 5 || (Math.abs(z - CAVE.z) < 10 && x > -4 && x < CAVE.x) || Math.hypot(x - 60, z - 30) < 6) continue;
    const it = { x, z, s: rng(.9, 1.9) * (gy > 8 ? .7 : 1), rot: Math.random() * 6, hue: Math.random() }; (Math.random() < (gy > 6 ? .8 : .5) ? con : broad).push(it); treeSpots.push([x, z]);
  }
  for (let i = 0; i < 600; i++) { const x = rng(-HALF, HALF), z = rng(-HALF, HALF); if (inWater(x, z) || Math.hypot(x, z) < 6 || groundY(x, z) > TREELINE) continue; bushes.push({ x, z, s: rng(.7, 1.5) }); }
  for (let i = 0; i < 260; i++) { const x = rng(-HALF, HALF), z = rng(-HALF, HALF); const gy = groundY(x, z); if (gy < WATER_Y || gy > TREELINE + 4 || Math.hypot(x, z) < 26 || nearBuilding(x, z, 6)) continue; deadTrees.push({ x, z, s: rng(.8, 1.6), rot: Math.random() * 6 }); }
  treeSpots.forEach(([tx, tz], i) => { if (i % 2) return; for (let k = 0; k < 2; k++) { const x = tx + rng(-4, 4), z = tz + rng(-4, 4); if (inWater(x, z) || Math.hypot(x, z) < 20) continue; ferns.push({ x, z, s: rng(.7, 1.4), rot: Math.random() * 6 }); } });
  for (let i = 0; i < 140; i++) { const x = rng(-HALF, HALF), z = rng(-HALF, HALF); const gy = groundY(x, z); if (gy < WATER_Y || gy > TREELINE || Math.hypot(x, z) < 22 || nearBuilding(x, z, 7)) continue; logs.push({ x, z, s: rng(.8, 1.5), rot: Math.random() * 6 }); }
  for (let i = 0; i < 520; i++) { const x = rng(-HALF, HALF), z = rng(-HALF, HALF); if (inWater(x, z)) continue; const gy = groundY(x, z); rocks.push({ x, z, s: rng(.3, 1.3) * (gy > 9 ? 2.2 : 1), rx: Math.random(), ry: Math.random() }); }
  const flowerCols = [0xff6b9a, 0xffd166, 0xb48cff, 0xffffff, 0xff8c42];
  for (let i = 0; i < 1800; i++) { const x = rng(-HALF, HALF), z = rng(-HALF, HALF); if (inWater(x, z) || groundY(x, z) > TREELINE) continue; flowers.push({ x, z, c: flowerCols[i % 5] }); }
  for (let i = 0; i < 160; i++) { const x = rng(-HALF, HALF), z = rng(-HALF, HALF); if (inWater(x, z) || groundY(x, z) > TREELINE) continue; shrooms.push({ x, z }); }
  for (let i = 0; i < 200; i++) { const a = Math.random() * Math.PI * 2, r = LAKE.r * (0.86 + Math.random() * .12); reeds.push({ x: LAKE.x + Math.cos(a) * r, z: LAKE.z + Math.sin(a) * r, h: rng(1.2, 2), rz: rng(-.15, .15) }); }

  function instanced(geo, material, n, fill, shadow = true) {
    const m = new THREE.InstancedMesh(geo, material, n); const d = new THREE.Object3D(), col = new THREE.Color(); let k = 0;
    fill((px, py, pz, rx, ry, rz, sx, sy, sz, c) => { d.position.set(px, py, pz); d.rotation.set(rx, ry, rz); d.scale.set(sx, sy, sz); d.updateMatrix(); m.setMatrixAt(k, d.matrix); if (c !== undefined) m.setColorAt(k, col.set(c)); k++; });
    m.count = k; m.castShadow = shadow; m.receiveShadow = shadow; m.frustumCulled = false; scene.add(m); return m;
  }
  const white = (o = {}) => weatherize(new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, roughness: .85 }, o)), { snowLow: .1 });
  // Blatt-/Nadeltexturen für Laubkarten
  function makeLeafTex(conifer) {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
    if (conifer) { for (let i = 0; i < 70; i++) { const x = 30 + Math.random() * 196, y = 30 + Math.random() * 196, a0 = Math.random() * 6.3; for (let k = 0; k < 26; k++) { const a = a0 + (Math.random() - .5) * 2.2, l = 10 + Math.random() * 26; c.strokeStyle = `hsla(${118 + Math.random() * 22},${40 + Math.random() * 25}%,${18 + Math.random() * 22}%,${.75 + Math.random() * .25})`; c.lineWidth = 1.2 + Math.random(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } } }
    else { for (let i = 0; i < 150; i++) { const x = 28 + Math.random() * 200, y = 28 + Math.random() * 200, r = 7 + Math.random() * 11, a = Math.random() * 6.3, h = 78 + Math.random() * 42, l = 26 + Math.random() * 24; c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = `hsla(${h},${45 + Math.random() * 25}%,${l}%,.96)`; c.beginPath(); c.ellipse(0, 0, r, r * .5, 0, 0, 7); c.fill(); c.strokeStyle = `hsla(${h},40%,${l - 12}%,.8)`; c.lineWidth = 1; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke(); c.restore(); } }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  const leafTex = makeLeafTex(false), needleTex = makeLeafTex(true);
  const cardMat = (tex) => weatherize(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .9, color: 0xffffff }), { snowLow: -.5, snowMax: .7 });
  const cardDepth = (tex) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .45 });
  const cardGeo = new THREE.PlaneGeometry(1, 1);
  const tmpC = new THREE.Color();
  // Bäume: gezeichnete Baum-Texturen auf drei gekreuzten Flächen (wie in modernen Spielen für Wald), dazu echte Stämme
  function drawConifer() {
    const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    c.lineCap = 'round';
    // Stamm
    const tg = c.createLinearGradient(236, 0, 276, 0); tg.addColorStop(0, '#2b1a0e'); tg.addColorStop(.5, '#5a3a21'); tg.addColorStop(1, '#241408'); c.fillStyle = tg; c.beginPath(); c.moveTo(243, 1010); c.lineTo(269, 1010); c.lineTo(260, 120); c.lineTo(252, 120); c.closePath(); c.fill();
    for (let tier = 0; tier < 11; tier++) {
      const cy = 110 + tier * 82, halfW = 28 + tier * 21, lightT = 1 - tier / 11;
      for (const side of [-1, 1]) for (let k = 0; k < 16; k++) {
        const sx = 256, sy = cy - 30 + Math.random() * 50, len = halfW * (.45 + Math.random() * .6), ex = sx + side * len, ey = sy + 18 + Math.random() * 55;
        c.strokeStyle = 'rgba(40,28,14,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
        const n = 16; for (let j = 0; j < n; j++) { const t = j / n, px = sx + (ex - sx) * t, py = sy + (ey - sy) * t; for (const dir of [-1, 1]) { const ang = Math.atan2(ey - sy, ex - sx) + dir * (.9 + Math.random() * .5) + .35, l = 9 + Math.random() * 15; const L = 16 + lightT * 14 + t * 14 + Math.random() * 10; c.strokeStyle = `hsla(${112 + Math.random() * 20},${38 + Math.random() * 22}%,${L}%,${.75 + Math.random() * .25})`; c.lineWidth = 1.6 + Math.random(); c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * l, py + Math.sin(ang) * l); c.stroke(); } }
      }
    }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function drawBroadleaf() {
    const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    c.lineCap = 'round';
    const tg = c.createLinearGradient(226, 0, 286, 0); tg.addColorStop(0, '#2a190c'); tg.addColorStop(.5, '#6a4628'); tg.addColorStop(1, '#22130a'); c.fillStyle = tg; c.beginPath(); c.moveTo(236, 1010); c.lineTo(276, 1010); c.lineTo(266, 480); c.lineTo(246, 480); c.closePath(); c.fill();
    c.strokeStyle = '#3a2614'; for (let i = 0; i < 6; i++) { const ang = -Math.PI / 2 + (i - 2.5) * .42; c.lineWidth = 9 - i % 3; c.beginPath(); c.moveTo(256, 560); c.quadraticCurveTo(256 + Math.cos(ang) * 120, 420 + Math.sin(ang) * 60, 256 + Math.cos(ang) * 210, 330 + Math.sin(ang) * 130); c.stroke(); }
    const CX = 256, CY = 360, RX = 232, RY = 300;
    for (let i = 0; i < 2600; i++) {
      let x, y, d; do { x = CX + (Math.random() * 2 - 1) * RX; y = CY + (Math.random() * 2 - 1) * RY; d = ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2; } while (d > 1 || (d > .78 && Math.random() < .55));
      const lit = (1 - (y - (CY - RY)) / (2 * RY)) * .6 + (1 - (x - (CX - RX)) / (2 * RX)) * .25 + (1 - d) * .15; const L = 16 + lit * 30 + (Math.random() - .5) * 8, r = (d > .7 ? 6 : 9) + Math.random() * 9;
      c.fillStyle = `hsla(${88 + Math.random() * 34},${42 + Math.random() * 22}%,${L}%,${.85 + Math.random() * .15})`; c.beginPath(); c.ellipse(x, y, r, r * (.55 + Math.random() * .4), Math.random() * 3, 0, 7); c.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  const coniferTex = drawConifer(), broadTex = drawBroadleaf();
  // Flächen werden wie "nach oben zeigend" beleuchtet, damit keine Seite schwarz wird; Schatten über Tiefen-Material mit Alpha
  const treeMat = (tex) => { const m = weatherize(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .95, color: 0xffffff }), { snowLow: -1, snowMax: .55 }); const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { sh.uniforms.uT = WORLD_U.time; sh.uniforms.uWind2 = WORLD_U.wind; sh.vertexShader = 'uniform float uT; uniform float uWind2;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n { float ph = instanceMatrix[3][0] * .37 + instanceMatrix[3][2] * .23; float sw = (sin(uT * 1.1 + ph) * .5 + sin(uT * 2.3 + ph * 1.7) * .25) * (.06 + uWind2 * .22) * uv.y * uv.y; transformed.x += sw; transformed.z += sw * .4; }'); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(normal * 0.35 + (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); geometryNormal = normal;'); prev(sh, r); }; return m; };
  const treeDepth = (tex) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5 });
  const treePlane = new THREE.PlaneGeometry(1, 1); treePlane.translate(0, .5, 0);
  instanced(new THREE.CylinderGeometry(.14, .32, 3, 7), barkMat, con.length, put => con.forEach(t => put(t.x, groundY(t.x, t.z) - .15 + 1.5 * t.s, t.z, 0, t.rot, 0, t.s, t.s, t.s)));
  (function () { const m = instanced(treePlane, treeMat(coniferTex), con.length * 3, put => con.forEach(t => { tmpC.setHSL(0, 0, .5 + t.hue * .35); for (let i = 0; i < 3; i++) put(t.x, groundY(t.x, t.z) - .2, t.z, 0, t.rot + i * Math.PI / 3, 0, 5.6 * t.s, 10.5 * t.s, 1, tmpC.getHex()); })); m.customDepthMaterial = treeDepth(coniferTex); })();
  instanced(new THREE.CylinderGeometry(.22, .45, 3, 8), barkMat2, broad.length, put => broad.forEach(t => put(t.x, groundY(t.x, t.z) - .15 + 1.5 * t.s, t.z, 0, t.rot, 0, t.s, t.s, t.s)));
  (function () { const m = instanced(treePlane, treeMat(broadTex), broad.length * 3, put => broad.forEach(t => { tmpC.setHSL(.02 * t.hue, .15, .5 + t.hue * .3); for (let i = 0; i < 3; i++) put(t.x, groundY(t.x, t.z) - .2, t.z, 0, t.rot + i * Math.PI / 3, 0, 7.2 * t.s, 9.6 * t.s, 1, tmpC.getHex()); })); m.customDepthMaterial = treeDepth(broadTex); })();
  // ein paar Blattkarten quer in der Krone (Tiefe von schräg oben)
  (function () { const m = instanced(cardGeo, cardMat(leafTex), broad.length * 4, put => broad.forEach(t => { const base = new THREE.Color().setHSL(.25 + t.hue * .1, .5, .36); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + t.rot, rad = 1.3 * t.s, yy = (4.2 + Math.random() * 2.4) * t.s, w = (2.6 + Math.random() * 1.2) * t.s; tmpC.copy(base).offsetHSL(0, 0, (yy / t.s - 4.2) * .06); put(t.x + Math.cos(a) * rad, groundY(t.x, t.z) - .15 + yy, t.z + Math.sin(a) * rad, -Math.PI / 2 + (Math.random() - .5) * .8, Math.random() * 3, 0, w, w, 1, tmpC.getHex()); } })); m.customDepthMaterial = cardDepth(leafTex); })();
  // Tote Bäume: kahler Stamm mit vier Ästen
  const deadMat = weatherize(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: makeBarkTex('#4a3d31') }));
  instanced(new THREE.CylinderGeometry(.07, .38, 6, 7), deadMat, deadTrees.length, put => deadTrees.forEach(t => put(t.x, groundY(t.x, t.z) - .2 + 3 * t.s, t.z, rng(-.05, .05), t.rot, rng(-.05, .05), t.s, t.s, t.s)));
  instanced(new THREE.CylinderGeometry(.03, .11, 2.4, 5), deadMat, deadTrees.length * 4, put => deadTrees.forEach(t => { for (let b = 0; b < 4; b++) { const a = t.rot + b * 1.57 + rng(-.4, .4), h = (3 + b * .55) * t.s; put(t.x + Math.cos(a) * .9 * t.s, groundY(t.x, t.z) - .2 + h, t.z + Math.sin(a) * .9 * t.s, Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1 + rng(-.2, .2), t.s, t.s, t.s); } }), false);
  // Farne: zwei gekreuzte Karten mit gezeichneten Wedeln
  function makeFernTex() { const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.lineCap = 'round'; for (let f = 0; f < 9; f++) { const a = -Math.PI / 2 + (f - 4) * .3, len = 95 + Math.random() * 50; const x0 = 128, y0 = 250; c.strokeStyle = 'hsla(110,45%,22%,.95)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + Math.cos(a) * len * .5, y0 + Math.sin(a) * len * .5 - 10, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); c.stroke(); for (let k = 0; k < 18; k++) { const t = k / 18, px = x0 + Math.cos(a) * len * t, py = y0 + Math.sin(a) * len * t - 10 * Math.sin(t * Math.PI); const l = (1 - Math.abs(t - .45)) * 22 * (1 - t * .3); for (const s of [-1, 1]) { c.strokeStyle = `hsla(${105 + Math.random() * 25},${45 + Math.random() * 20}%,${28 + t * 18 + Math.random() * 8}%,.95)`; c.lineWidth = 3.2; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a + s * 1.2) * l, py + Math.sin(a + s * 1.2) * l); c.stroke(); } } } const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; }
  const fernTex = makeFernTex();
  (function () { const mm = instanced(cardGeo, cardMat(fernTex), ferns.length * 2, put => ferns.forEach(f => { for (let k = 0; k < 2; k++) put(f.x, groundY(f.x, f.z) - .05 + .6 * f.s, f.z, 0, f.rot + k * Math.PI / 2, 0, 1.4 * f.s, 1.3 * f.s, 1); }), false); mm.customDepthMaterial = cardDepth(fernTex); })();
  // Umgestürzte Stämme
  instanced(new THREE.CylinderGeometry(.28, .36, 3.6, 8), barkMat2, logs.length, put => logs.forEach(l => put(l.x, groundY(l.x, l.z) + .28 * l.s, l.z, rng(-.06, .06), l.rot, Math.PI / 2, l.s, l.s, l.s)));
  // Baumschatten am Boden
  instanced(new THREE.CircleGeometry(1, 14), treeShadowMat, con.length + broad.length, put => { con.forEach(t => put(t.x, groundY(t.x, t.z) + .04, t.z, -Math.PI / 2, 0, 0, 1.9 * t.s, 1.9 * t.s, 1)); broad.forEach(t => put(t.x, groundY(t.x, t.z) + .04, t.z, -Math.PI / 2, 0, 0, 2.3 * t.s, 2.3 * t.s, 1)); }, false);
  // Boden unter Bäumen leicht abdunkeln (eingebackene Umgebungsverdeckung)
  (function () { const cell = 6, grid = new Map(), key = (x, z) => (Math.floor(x / cell) + 1000) * 4000 + (Math.floor(z / cell) + 1000); treeSpots.forEach(t => { const k = key(t[0], t[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); }); const ca = groundGeo.attributes.color, pa = groundGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); let ao = 0; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const l = grid.get(key(x + dx * cell, z + dz * cell)); if (l) for (const t of l) { const d = Math.hypot(t[0] - x, t[1] - z); if (d < 5) ao += (1 - d / 5) * .45; } } ao = Math.min(.5, ao); if (ao > 0) ca.setXYZ(i, ca.getX(i) * (1 - ao), ca.getY(i) * (1 - ao), ca.getZ(i) * (1 - ao)); } ca.needsUpdate = true; })();
  // Büsche, Felsen, Blumen, Pilze, Schilf
  instanced(new THREE.IcosahedronGeometry(.5, 1), weatherize(mat(0x2f8a45)), bushes.length * 3, put => bushes.forEach(b => { for (let i = 0; i < 3; i++) put(b.x + rng(-.4, .4) * b.s, groundY(b.x, b.z) + .35 * b.s, b.z + rng(-.4, .4) * b.s, 0, Math.random() * 3, 0, b.s, b.s, b.s); }));
  instanced((function () { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position, col = []; const n = (x, y, z) => Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - x * 1.1) * .5 + Math.sin(y * 5.3 + z * 2.9) * .25; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = 1 + n(x, y, z) * .28 + (Math.random() - .5) * .06; p.setXYZ(i, x * d * 1.15, y * d * .8, z * d); } g.computeVertexNormals(); const nn = g.attributes.normal; for (let i = 0; i < p.count; i++) { const up = Math.max(0, nn.getY(i)); const moss = Math.pow(up, 2.2) * (.55 + Math.random() * .45); const g0 = .42 + (Math.random() - .5) * .14; col.push(g0 * (1 - moss) + .36 * moss, g0 * (1 - moss) + .55 * moss, g0 * (1 - moss) + .3 * moss); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; })(), weatherize(new THREE.MeshStandardMaterial({ color: 0x8e948f, roughness: .95, vertexColors: true, normalMap: groundNrm, normalScale: new THREE.Vector2(.7, .7) })), rocks.length, put => rocks.forEach(r => put(r.x, groundY(r.x, r.z) + .15 * r.s, r.z, r.rx, r.ry, 0, r.s, r.s * .8, r.s)));
  instanced(new THREE.IcosahedronGeometry(.11, 0), white(), flowers.length, put => flowers.forEach(f => put(f.x, groundY(f.x, f.z) + .5, f.z, 0, 0, 0, 1, 1, 1, f.c)), false);
  instanced(new THREE.CylinderGeometry(.02, .02, .5, 4), smooth(0x3f8f3a), flowers.length, put => flowers.forEach(f => put(f.x, groundY(f.x, f.z) + .25, f.z, 0, 0, 0, 1, 1, 1)), false);
  instanced(new THREE.SphereGeometry(.22, 8, 6, 0, 6.3, 0, 1.6), smooth(0xd8402c), shrooms.length, put => shrooms.forEach(m => put(m.x, groundY(m.x, m.z) + .22, m.z, 0, 0, 0, 1, 1, 1)), false);
  instanced(new THREE.CylinderGeometry(.07, .09, .25, 6), smooth(0xf1e6d2), shrooms.length, put => shrooms.forEach(m => put(m.x, groundY(m.x, m.z) + .12, m.z, 0, 0, 0, 1, 1, 1)), false);
  instanced(new THREE.CylinderGeometry(.03, .05, 1, 4), smooth(0x6f8f3a), reeds.length, put => reeds.forEach(r => put(r.x, groundY(r.x, r.z) + r.h / 2, r.z, 0, 0, r.rz, 1, r.h, 1)), false);
  // Steg am See
  (function () { const steg = new THREE.Mesh(new THREE.BoxGeometry(2.2, .2, 10), mat(0x8a5a33)); steg.position.set(LAKE.x - LAKE.r + 2, WATER_Y + .35, LAKE.z - 6); steg.castShadow = true; scene.add(steg); for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 2, 6), barkMat); p.position.set(LAKE.x - LAKE.r + 2 + (i % 2 ? .9 : -.9), WATER_Y - .3, LAKE.z - 10 + Math.floor(i / 2) * 8); scene.add(p); } })();

  // ===== Troll-Festung (komplett neu): Steinmauer mit zwei Türmen vor einer Felswand, Fallgitter, Feuerschalen, Schädelpfähle =====
  const gate = new THREE.Group(); gate.userData = { open: false, lift: 0 };
  (function () {
    const gy0 = groundY(CAVE.x - CAVE.r, CAVE.z), ex = CAVE.x - CAVE.r + 1, ez = CAVE.z; // Torlinie
    const stone = weatherize(new THREE.MeshStandardMaterial({ color: 0x2a2e2c, roughness: .95, normalMap: groundNrm, normalScale: new THREE.Vector2(.9, .9) })), stoneD = weatherize(new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 1, normalMap: groundNrm, normalScale: new THREE.Vector2(.9, .9) })), wood = new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 1 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x3b3f44, metalness: .8, roughness: .45 });
    // Felswand: große Platten im Halbkreis hinter der Mauer (keine runde Kuppel mehr)
    for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + Math.PI * (i / 25); const r = CAVE.r + rng(-1.5, 1.5); const x = CAVE.x + Math.cos(a) * r, z = CAVE.z + Math.sin(a) * r; const h = rng(9, 16); const slab = new THREE.Mesh(new THREE.BoxGeometry(rng(3, 5), h, rng(3, 5)), i % 3 ? stone : stoneD); slab.position.set(x, groundY(x, z) + h / 2 - 1, z); slab.rotation.set(rng(-.08, .08), a + rng(-.3, .3), rng(-.1, .1)); slab.castShadow = true; slab.receiveShadow = true; scene.add(slab); }
    for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + Math.PI * (i / 17); const r = CAVE.r - 2; const x = CAVE.x + Math.cos(a) * r, z = CAVE.z + Math.sin(a) * r; const h = rng(5, 9); const slab = new THREE.Mesh(new THREE.BoxGeometry(rng(2.5, 4), h, rng(2.5, 4)), stoneD); slab.position.set(x, groundY(x, z) + h / 2 - 1, z); slab.rotation.y = a + rng(-.3, .3); slab.castShadow = true; scene.add(slab); }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(CAVE.r - 1, CAVE.r + 1, 2, 24, 1, false, 0, Math.PI), stoneD); cap.rotation.y = -Math.PI / 2; cap.position.set(CAVE.x, groundY(CAVE.x, CAVE.z) + 10, CAVE.z); scene.add(cap);
    // Innenraum: dunkle Halle, Boden, rotes Licht
    const hall = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 20), new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 1, side: THREE.BackSide })); hall.position.set(CAVE.x + 1, gy0 + 5.5, ez); scene.add(hall);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(24, .3, 20), new THREE.MeshStandardMaterial({ color: 0x2a2d2b, roughness: 1 })); floor.position.set(CAVE.x + 1, gy0 - .02, ez); floor.receiveShadow = true; scene.add(floor);
    const redGlow = new THREE.PointLight(0xff3a2a, 3, 26, 2); redGlow.position.set(CAVE.x + 2, gy0 + 4, ez); scene.add(redGlow);
    // Mauer mit Zinnen und zwei Türmen
    const wallH = 7, towerH = 11;
    for (const sgn of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, wallH, 9), stone); w.position.set(ex, gy0 + wallH / 2, ez + sgn * 10.5); w.castShadow = true; w.receiveShadow = true; scene.add(w);
      for (let k = 0; k < 4; k++) { const z = ez + sgn * (6.5 + k * 2.4); const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.2), stone); m.position.set(ex, gy0 + wallH + .5, z); scene.add(m); }
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, towerH, 12), stone); tower.position.set(ex, gy0 + towerH / 2, ez + sgn * 6); tower.castShadow = true; scene.add(tower);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const m = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.1, .9), stone); m.position.set(ex + Math.cos(a) * 2.5, gy0 + towerH + .55, ez + sgn * 6 + Math.sin(a) * 2.5); m.rotation.y = -a; scene.add(m); }
      const roofRing = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, .4, 12), stoneD); roofRing.position.set(ex, gy0 + towerH, ez + sgn * 6); scene.add(roofRing);
      // Feuerschale auf dem Turm
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.7, .4, .5, 10), iron); bowl.position.set(ex, gy0 + towerH + .9, ez + sgn * 6); scene.add(bowl);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.4, 8), new THREE.MeshBasicMaterial({ color: 0xffb13d, transparent: true, opacity: .95 })); flame.position.set(ex, gy0 + towerH + 1.8, ez + sgn * 6); scene.add(flame); gate.userData.flames = (gate.userData.flames || []).concat(flame);
      const fl = new THREE.PointLight(0xffa040, 2.2, 20, 2); fl.position.copy(flame.position); scene.add(fl);
      // Banner an der Mauer
      const bannerCv = document.createElement('canvas'); bannerCv.width = 128; bannerCv.height = 256; const bc = bannerCv.getContext('2d'); bc.fillStyle = '#5a0a12'; bc.fillRect(0, 0, 128, 256); bc.fillStyle = '#e6c25a'; bc.font = 'bold 110px serif'; bc.textAlign = 'center'; bc.fillText('\u2620', 64, 150); bc.fillStyle = '#2a0408'; bc.fillRect(0, 236, 128, 20);
      const bt = new THREE.CanvasTexture(bannerCv); bt.encoding = THREE.sRGBEncoding; const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide, roughness: 1 })); banner.position.set(ex - 1.25, gy0 + 4.2, ez + sgn * 11); banner.rotation.y = -Math.PI / 2; scene.add(banner);
    }
    // Torbogen über dem Durchgang + Warntafel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 10), stoneD); lintel.position.set(ex, gy0 + 7.1, ez); lintel.castShadow = true; scene.add(lintel);
    const archTop = new THREE.Mesh(new THREE.TorusGeometry(4.2, .9, 8, 20, Math.PI), stone); archTop.position.set(ex, gy0 + 2.2, ez); archTop.rotation.y = Math.PI / 2; scene.add(archTop);
    const signCv = document.createElement('canvas'); signCv.width = 512; signCv.height = 128; const sc = signCv.getContext('2d'); sc.fillStyle = '#1a0d08'; sc.fillRect(0, 0, 512, 128); sc.strokeStyle = '#ff2a3c'; sc.lineWidth = 8; sc.strokeRect(6, 6, 500, 116); sc.fillStyle = '#ff2a3c'; sc.font = 'bold 58px sans-serif'; sc.textAlign = 'center'; sc.fillText('\u2620 WALDTROLL', 256, 62); sc.font = 'bold 30px sans-serif'; sc.fillStyle = '#ffd166'; sc.fillText('BOSS \u00b7 AB LEVEL 10', 256, 106);
    const st = new THREE.CanvasTexture(signCv); st.encoding = THREE.sRGBEncoding; const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshStandardMaterial({ map: st, side: THREE.DoubleSide, roughness: .9 })); sign.position.set(ex - 1.4, gy0 + 9.4, ez); sign.rotation.y = -Math.PI / 2; scene.add(sign);
    // Glühende Augen in der Dunkelheit über dem Tor (der Troll beobachtet dich)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 2.5 });
    for (const sgn of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), eyeMat); e.position.set(ex + 6, gy0 + 7.5, ez + sgn * 1.3); scene.add(e); }
    // Fallgitter (hebt sich ab Level 10)
    for (let i = 0; i < 7; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 6.4, 8), iron); bar.position.set(0, 3.2, -3.9 + i * 1.3); bar.castShadow = true; gate.add(bar); const tip = new THREE.Mesh(new THREE.ConeGeometry(.14, .5, 6), iron); tip.position.set(0, -.2, -3.9 + i * 1.3); tip.rotation.x = Math.PI; gate.add(tip); }
    for (const y of [1, 3.2, 5.4]) { const cross = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, 8.4), iron); cross.position.set(0, y, 0); gate.add(cross); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(.45, .7, 1), new THREE.MeshStandardMaterial({ color: 0xe6c25a, metalness: .85, roughness: .3 })); lock.position.set(0, 3.2, 0); gate.add(lock); gate.userData.lock = lock;
    gate.position.set(ex, gy0, ez); scene.add(gate);
    // Schädelpfähle und Knochenzaun entlang des Weges, Blutflecken, Krähen auf der Mauer
    const bone = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: .8 });
    for (const sgn of [-1, 1]) for (let i = 0; i < 6; i++) { const px = ex - 4 - i * 2.4, pz = ez + sgn * 6.5; const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, rng(2.4, 3.2), 6), wood); p.position.set(px, groundY(px, pz) + p.geometry.parameters.height / 2, pz); p.rotation.z = rng(-.1, .1); scene.add(p); if (i % 2 === 0) { const sk = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), bone); sk.scale.set(1, .85, 1.1); sk.position.set(px, p.position.y + p.geometry.parameters.height / 2 + .25, pz); scene.add(sk); } const rail = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.4, 5), bone); rail.position.set(px - 1.2, groundY(px, pz) + 1, pz); rail.rotation.z = Math.PI / 2; scene.add(rail); }
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x4a0a0a, roughness: 1, transparent: true, opacity: .8 });
    for (let i = 0; i < 7; i++) { const bx = ex - rng(1, 10), bz = ez + rng(-5, 5); const bl = new THREE.Mesh(new THREE.CircleGeometry(rng(.4, 1.1), 10), bloodMat); bl.rotation.x = -Math.PI / 2; bl.position.set(bx, groundY(bx, bz) + .02, bz); scene.add(bl); }
    for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, rng(.5, .9), 6), bone); const bx = ex - rng(1, 8), bz = ez + rng(-4, 4); b.position.set(bx, groundY(bx, bz) + .06, bz); b.rotation.set(Math.PI / 2, 0, Math.random() * 3); scene.add(b); }
    for (let i = 0; i < 4; i++) { const crow = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); crow.scale.set(1, .8, 1.5); const cz = ez + (i < 2 ? -1 : 1) * (7 + (i % 2) * 3); crow.position.set(ex, gy0 + wallH + 1.2, cz); scene.add(crow); }
    // Steinweg zum Tor
    for (let i = 0; i < 14; i++) { const sx = ex - 2 - i * 1.6, sz = ez + Math.sin(i * .9) * .9; const s2 = new THREE.Mesh(new THREE.CylinderGeometry(rng(.4, .6), rng(.5, .7), .12, 7), new THREE.MeshStandardMaterial({ color: 0x5c605a, roughness: 1 })); s2.position.set(sx, groundY(sx, sz) + .07, sz); s2.rotation.y = Math.random() * 3; s2.receiveShadow = true; scene.add(s2); }
    const lantern = new THREE.Group(); const lb = new THREE.Mesh(new THREE.BoxGeometry(.3, .45, .3), iron); lantern.add(lb); const lg = new THREE.Mesh(new THREE.BoxGeometry(.22, .3, .22), new THREE.MeshBasicMaterial({ color: 0xffd27a })); lantern.add(lg); const ll = new THREE.PointLight(0xffc766, 1.5, 9, 2); lantern.add(ll); lantern.position.set(ex - .9, gy0 + 5.6, ez); scene.add(lantern); gate.userData.lantern = lantern;
  })();
  function leatherLike(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: .85 }); }
  const gateDist = () => Math.hypot(player.position.x - gate.position.x, player.position.z - gate.position.z);
  function tryGate() {
    if (gate.userData.open) { toast('Das Tor steht offen'); return; }
    if (state.level < 10) { toast(`Verschlossen · Troll-Höhle ab Level 10 (du bist Level ${state.level})`); return; }
    gate.userData.open = true; toast('Das Gitter hebt sich – der Waldtroll wartet in der Höhle'); gainXp(0);
  }
  function caveCollision() {
    const dx = player.position.x - CAVE.x, dz = player.position.z - CAVE.z, d = Math.hypot(dx, dz), inCorridor = Math.abs(dz) < 4.5 && dx < 0;
    if (d < CAVE.r - 1 && !(inCorridor && gate.userData.open)) { if (inCorridor) { player.position.x = gate.position.x - 1.2; } else { const k = (CAVE.r - 1) / d; player.position.x = CAVE.x + dx * k; player.position.z = CAVE.z + dz * k; } }
  }

  // Lager
  const fire = new THREE.PointLight(0xffa040, 2.5, 16, 2); fire.position.set(3, 2.4, -3); scene.add(fire);
  for (let i = 0; i < 6; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.1, 6), barkMat); log.position.set(3, 1.35, -3); log.rotation.set(Math.PI / 2, 0, i * Math.PI / 3); scene.add(log); }
  for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.18, 0), mat(0x6f6f6f)); const a = i / 9 * Math.PI * 2; st.position.set(3 + Math.cos(a) * .8, 1.32, -3 + Math.sin(a) * .8); scene.add(st); }
  const flames = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.28 - i * .07, .9 - i * .2, 6), new THREE.MeshBasicMaterial({ color: [0xff7a1a, 0xffb13d, 0xfff2a8][i], transparent: true, opacity: .9 })); f.position.set(3, 1.65 + i * .15, -3); scene.add(f); flames.push(f); }
  const smokeGeo = new THREE.BufferGeometry(); const smokeP = []; for (let i = 0; i < 40; i++) smokeP.push(3, 2 + Math.random() * 4, -3); smokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(smokeP, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ color: 0xd9d9d9, size: .5, transparent: true, opacity: .35 })); scene.add(smoke);
  (function () { const t = new THREE.Group(); const body = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.6, 4), mat(0xc96a3b)); body.position.y = 1.3; body.rotation.y = Math.PI / 4; body.castShadow = true; t.add(body); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3, 5), barkMat); pole.position.y = 1.5; t.add(pole); const flag = new THREE.Mesh(new THREE.PlaneGeometry(.7, .4), new THREE.MeshStandardMaterial({ color: 0x7cff9b, side: THREE.DoubleSide })); flag.position.set(.35, 2.8, 0); t.add(flag); t.position.set(-5, groundY(-5, -4), -4); scene.add(t); })();
  for (const [x, z, r] of [[1, -6.5, .3], [6.5, -5, 1.4]]) { const seat = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 2.2, 7), barkMat); seat.position.set(x, 1.5, z); seat.rotation.set(Math.PI / 2, 0, r); seat.castShadow = true; scene.add(seat); }

  // Stationen, Truhen
  const stations = [];
  [[14, 10], [-12, 18], [22, -16], [45, 20], [-30, -40], [60, -50], [-70, 40], [20, 110], [-140, 90], [160, -40], [90, 170], [-180, -120], [210, 120], [-60, -210], [230, -190], [-230, 180]].forEach(([x, z]) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(.75, 0), new THREE.MeshStandardMaterial({ color: 0x7cff9b, emissive: 0x3fd66d, emissiveIntensity: 1.2, roughness: .2 })); c.position.y = 1.4; g.add(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .06, 6, 24), new THREE.MeshStandardMaterial({ color: 0x7cff9b, emissive: 0x7cff9b, emissiveIntensity: .8 })); ring.rotation.x = Math.PI / 2; ring.position.y = .12; g.add(ring);
    
    g.position.set(x, groundY(x, z), z); scene.add(g); stations.push({ g, c, ring, done: false });
  });
  function buildChest(x, z) {
    const chest = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.BoxGeometry(1.1, .6, .75), mat(0x9a6a33)); cb.position.y = .3; cb.castShadow = true; chest.add(cb);
    const lid = new THREE.Group(); const cl = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, 1.1, 10, 1, false, 0, Math.PI), mat(0x9a6a33)); cl.rotation.z = Math.PI / 2; cl.position.set(0, 0, .375); lid.add(cl); lid.position.set(0, .6, -.375); chest.add(lid);
    for (const bx of [-.35, .35]) { const band = new THREE.Mesh(new THREE.BoxGeometry(.1, .64, .8), smooth(0xf2c14e, { metalness: .6, roughness: .35 })); band.position.set(bx, .3, 0); chest.add(band); }
    chest.position.set(x, groundY(x, z), z); chest.rotation.y = Math.random() * 6; scene.add(chest); chest.userData = { lid, open: false }; return chest;
  }
  const chests = [[-9, 12], [38, -28], [-55, 60], [95, 30], [-120, -40], [140, -90], [60, 140], [-80, 130], [150, 110], [-150, 20], [20, -130], [110, -160], [220, 60], [-220, -60], [40, 230], [-40, -240], [250, -120], [-250, 140], [190, 220], [-190, -220]].map(([x, z], i) => { const c = buildChest(x, z); if (i % 4 === 3) { c.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0x9a6a33) o.material = new THREE.MeshStandardMaterial({ color: 0xe6c25a, metalness: .85, roughness: .28 }); }); c.userData.gold = true; const l = new THREE.PointLight(0xffd166, 1.2, 6, 2); l.position.y = 1; c.add(l); } return c; });
  // Hütten und Ruinen mit Beute
  const hutMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: .95 }), roofMat = weatherize(new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 1, normalMap: groundNrm, normalScale: new THREE.Vector2(.5, .5) })), stoneMat = weatherize(new THREE.MeshStandardMaterial({ color: 0x4b4f4b, roughness: 1, normalMap: groundNrm, normalScale: new THREE.Vector2(.9, .9) })), stoneDark = weatherize(new THREE.MeshStandardMaterial({ color: 0x3f4244, roughness: 1, normalMap: groundNrm, normalScale: new THREE.Vector2(.9, .9) }));
  const plankMat = weatherize(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, map: makeBarkTex('#6a4a2d') })); plankMat.map.repeat.set(4, 1.5);
  const ivy = (parent, x, y, z, ry, s) => { const c = new THREE.Mesh(cardGeo, cardMat(leafTex)); c.position.set(x, y, z); c.rotation.set(rng(-.2, .2), ry, rng(-.3, .3)); c.scale.set(s, s, 1); c.customDepthMaterial = cardDepth(leafTex); parent.add(c); };
  HUTS.forEach(([hx, hz], i) => {
    const g = new THREE.Group(); const gy = groundY(hx, hz); const broken = i % 3 !== 1;
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, .4, 6.2), stoneDark); base.position.y = .2; g.add(base);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3, 5.4), plankMat); walls.position.y = 1.9; walls.castShadow = true; walls.receiveShadow = true; g.add(walls);
    for (let k = 0; k < 4; k++) { const beam = new THREE.Mesh(new THREE.BoxGeometry(.25, 3.2, .25), roofMat); beam.position.set(k < 2 ? -2.75 : 2.75, 1.9, k % 2 ? -2.75 : 2.75); beam.rotation.z = rng(-.04, .04); g.add(beam); }
    // Dach aus zwei Schrägen, eine Seite eingebrochen
    for (const s of [-1, 1]) { const slab = new THREE.Mesh(new THREE.BoxGeometry(6.6, .22, 3.9), roofMat); slab.position.set(0, 4.3, s * 1.55); slab.rotation.x = -s * .62; slab.castShadow = true; g.add(slab); if (broken && s === 1) { slab.scale.x = .55; slab.position.x = -1.45; const piece = new THREE.Mesh(new THREE.BoxGeometry(2.4, .2, 2.2), roofMat); piece.position.set(1.9, 3.4, 2.2); piece.rotation.set(-1.1, .3, .25); g.add(piece); } }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(6.8, .28, .28), roofMat); ridge.position.y = 5.15; g.add(ridge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, .14), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 })); door.position.set(.55, 1.45, 2.95); door.rotation.y = .7; g.add(door);
    for (const sx of [-1.6, 1.6]) { const win = new THREE.Mesh(new THREE.BoxGeometry(.9, .8, .16), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 1 })); win.position.set(sx, 2.2, 2.75); g.add(win); for (const r of [.55, -.55]) { const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, .14, .08), roofMat); board.position.set(sx, 2.2, 2.9); board.rotation.z = r; g.add(board); } }
    const chim = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.6, .7), stoneMat); chim.position.set(1.6, 5.1, -1.2); chim.rotation.z = .12; g.add(chim);
    const fallen = new THREE.Mesh(new THREE.BoxGeometry(.25, 3.4, .25), roofMat); fallen.position.set(-3.6, .5, 1.2); fallen.rotation.set(0, .4, 1.25); g.add(fallen);
    for (let k = 0; k < 6; k++) { const side = k % 4; const ry = [0, Math.PI, Math.PI / 2, -Math.PI / 2][side]; const off = rng(-1.8, 1.8); ivy(g, side === 2 ? 2.85 : side === 3 ? -2.85 : off, rng(1.2, 3), side === 0 ? 2.85 : side === 1 ? -2.85 : off, ry, rng(1.4, 2.2)); }
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 1), weatherize(mat(0x2f7a40))); const a = k * 2.1 + i; b.position.set(Math.cos(a) * 3.6, .35, Math.sin(a) * 3.6); b.scale.set(1.3, .8, 1.3); g.add(b); }
    g.position.set(hx, gy, hz); g.rotation.y = i * 1.1; scene.add(g);
    const cx = hx + Math.sin(i * 1.1) * 4.6, cz = hz + Math.cos(i * 1.1) * 4.6; chests.push(buildChest(cx, cz)); chests[chests.length - 1].rotation.y = i * 1.1;
  });
  RUINS.forEach(([rx, rz], i) => {
    const gy = groundY(rx, rz);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, r = 5.5; const h = k % 2 ? rng(1, 2.2) : rng(3.5, 5.5); const col = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, h, 10), stoneMat); const cx = rx + Math.cos(a) * r, cz = rz + Math.sin(a) * r; col.position.set(cx, groundY(cx, cz) + h / 2, cz); col.rotation.z = rng(-.08, .08); col.castShadow = true; scene.add(col); if (h > 3) { const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, .35, 1.2), stoneMat); cap.position.set(cx, col.position.y + h / 2 + .17, cz); scene.add(cap); } }
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; const w = new THREE.Mesh(new THREE.BoxGeometry(rng(3, 5), rng(1.2, 2.6), .7), stoneDark); const wx = rx + Math.cos(a) * 6.5, wz = rz + Math.sin(a) * 6.5; w.position.set(wx, groundY(wx, wz) + w.geometry.parameters.height / 2 - .2, wz); w.rotation.y = -a + Math.PI / 2; w.castShadow = true; scene.add(w); }
    for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(rng(.25, .7), 0), stoneMat); const bx = rx + rng(-6, 6), bz = rz + rng(-6, 6); b.position.set(bx, groundY(bx, bz) + .2, bz); b.rotation.set(Math.random(), Math.random(), 0); scene.add(b); }
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, .25, 12), stoneDark); floor.position.set(rx, gy + .05, rz); floor.receiveShadow = true; scene.add(floor);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, .42, 8, 18, Math.PI), stoneMat); const aa = i * .9; arch.position.set(rx + Math.cos(aa) * 7.5, groundY(rx + Math.cos(aa) * 7.5, rz + Math.sin(aa) * 7.5) + 2.6, rz + Math.sin(aa) * 7.5); arch.rotation.y = aa; arch.castShadow = true; scene.add(arch);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .4; const iv = new THREE.Mesh(cardGeo, cardMat(leafTex)); iv.position.set(rx + Math.cos(a) * 5.4, groundY(rx, rz) + rng(1, 3), rz + Math.sin(a) * 5.4); iv.rotation.set(rng(-.3, .3), -a, rng(-.4, .4)); iv.scale.set(1.8, 1.8, 1); iv.customDepthMaterial = cardDepth(leafTex); scene.add(iv); }
    const moss = new THREE.Mesh(new THREE.CircleGeometry(2.5, 10), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1, transparent: true, opacity: .7 })); moss.rotation.x = -Math.PI / 2; moss.position.set(rx + 1.5, gy + .2, rz - 1); scene.add(moss);
    const c = buildChest(rx, rz); c.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0x9a6a33) o.material = new THREE.MeshStandardMaterial({ color: 0xe6c25a, metalness: .85, roughness: .28 }); }); c.userData.gold = true; const l = new THREE.PointLight(0xffd166, 1.2, 6, 2); l.position.y = 1; c.add(l); chests.push(c);
  });

  // ---------- Figuren ----------
  function limb(len, r, c) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .8, r, len, 7), c); m.geometry.translate(0, -len / 2, 0); m.castShadow = true; return m; }
  const tigerMat = smooth(0xd6701a), tigerLight = smooth(0xf7dcb8), stripeMat = smooth(0x1e130b);
  function buildTiger() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(.62, 14, 10), tigerMat); body.scale.set(1.05, .85, 1.9); body.position.set(0, 1.05, 0); body.castShadow = true; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 8), tigerLight); belly.scale.set(.9, .6, 1.6); belly.position.set(0, .85, 0); g.add(belly);
    const chestM = new THREE.Mesh(new THREE.SphereGeometry(.58, 12, 10), tigerMat); chestM.position.set(0, 1.15, .85); chestM.castShadow = true; g.add(chestM);
    const head = new THREE.Group(); const skull = new THREE.Mesh(new THREE.SphereGeometry(.46, 14, 12), tigerMat); skull.castShadow = true; head.add(skull);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), tigerLight); snout.scale.set(1.1, .8, 1); snout.position.set(0, -.12, .4); head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), stripeMat); nose.position.set(0, -.05, .66); head.add(nose);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x3d8f3c, emissiveIntensity: .35, roughness: .3 })); eye.position.set(s * .2, .1, .4); head.add(eye); const ear = new THREE.Mesh(new THREE.ConeGeometry(.13, .22, 6), tigerMat); ear.position.set(s * .3, .42, -.05); ear.rotation.z = -s * .4; head.add(ear); const cheek = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), tigerLight); cheek.position.set(s * .17, -.16, .48); head.add(cheek); }
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(.05, .22, .05), stripeMat); st.position.set((i - 1) * .14, .32, .25); st.rotation.x = -.5; head.add(st); }
    head.position.set(0, 1.55, 1.3); g.add(head);
    for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .07), stripeMat); const a = (i % 2 ? 1 : -1); st.position.set(a * .5, 1.35, .85 - i * .22); st.rotation.z = -a * 1.05; g.add(st); }
    const legs = [];
    for (const [x, z] of [[-.35, .75], [.35, .75], [-.35, -.65], [.35, -.65]]) { const hip = new THREE.Group(); hip.position.set(x, 1.0, z); hip.add(limb(.55, .17, tigerMat)); const knee = new THREE.Group(); knee.position.y = -.55; knee.add(limb(.5, .13, tigerMat)); const paw = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), tigerLight); paw.scale.set(1, .6, 1.3); paw.position.y = -.5; knee.add(paw); hip.add(knee); g.add(hip); legs.push({ hip, knee }); }
    const tail = new THREE.Group(); tail.position.set(0, 1.25, -1.15); let parent = tail;
    for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .28, 6), i % 2 ? stripeMat : tigerMat); seg.geometry.rotateX(Math.PI / 2); seg.position.z = -.26; const j = new THREE.Group(); j.add(seg); j.position.z = i ? -.26 : 0; parent.add(j); parent = j; }
    g.add(tail); g.userData = { legs, tail, head, seatY: 1.35, landSpeed: 9, waterSpeed: 2.8 }; return g;
  }
  function buildTurtle() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12, 0, 6.3, 0, 1.6), mat(0x3f7a3b)); shell.scale.set(1.1, .7, 1.4); shell.position.y = .55; shell.castShadow = true; g.add(shell);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i < 3 ? 0 : .75; const sc = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, .12, 6), mat(0x5fa04c)); sc.position.set(i < 3 ? (i - 1) * .35 : Math.cos(a) * r, 1.15 - r * .3, i < 3 ? 0 : Math.sin(a) * r * 1.25); g.add(sc); }
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, .25, 16), mat(0x2f5c2a)); rim.scale.z = 1.3; rim.position.y = .5; g.add(rim);
    const head = new THREE.Group(); const skull = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 10), smooth(0x7cb563)); skull.scale.z = 1.3; head.add(skull);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), smooth(0x111111)); eye.position.set(s * .17, .1, .3); head.add(eye); }
    head.position.set(0, .75, 1.6); g.add(head);
    const legs = []; for (const [x, z] of [[-.8, .8], [.8, .8], [-.8, -.8], [.8, -.8]]) { const hip = new THREE.Group(); hip.position.set(x, .5, z); const l = limb(.6, .2, smooth(0x7cb563)); l.rotation.z = x > 0 ? -.7 : .7; hip.add(l); g.add(hip); legs.push({ hip, knee: hip }); }
    g.userData = { legs, tail: new THREE.Group(), head, seatY: 1.15, heroY: .95, landSpeed: 6.5, waterSpeed: 11 }; return g;
  }
  function buildHero(ch) {
    const g = new THREE.Group();
    const skin = smooth(0xf1c9a5), cloth = smooth(ch.cloth), cloth2 = smooth(ch.cloth2), hairM = smooth(ch.hair);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .3), cloth); torso.position.y = 1.1; torso.castShadow = true; g.add(torso);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(.52, .08, .32), smooth(0x6b4426)); belt.position.y = .82; g.add(belt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.26, 14, 12), skin); head.position.y = 1.62; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10, 0, 6.3, 0, 1.7), hairM); hair.position.y = 1.66; hair.rotation.x = -.25; g.add(hair);
    if (ch.style === 'spiky') for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(.08, .28, 5), hairM); sp.position.set((i - 1.5) * .11, 1.9, -.05 + (i % 2) * .08); sp.rotation.z = (i - 1.5) * .35; g.add(sp); }
    if (ch.style === 'pony') { const p = new THREE.Mesh(new THREE.CylinderGeometry(.08, .04, .6, 6), hairM); p.position.set(0, 1.5, -.3); p.rotation.x = .5; g.add(p); }
    if (ch.style === 'long') { const p = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .14), hairM); p.position.set(0, 1.35, -.2); g.add(p); }
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), smooth(0x1b2a3a)); eye.position.set(s * .1, 1.64, .22); g.add(eye); }
    const arms = []; for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * .32, 1.35, 0); sh.add(limb(.55, .09, cloth)); const hand = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), skin); hand.position.y = -.55; sh.add(hand); g.add(sh); arms.push(sh); }
    const legs = [], boots = [];
    for (const s of [-1, 1]) { const hp = new THREE.Group(); hp.position.set(s * .14, .82, 0); hp.add(limb(.6, .11, cloth2)); const boot = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, .3), smooth(0x3b2a1a)); boot.position.set(0, -.62, .05); hp.add(boot); g.add(hp); legs.push(hp); boots.push(boot); }
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(.55, .8, 1, 4), new THREE.MeshStandardMaterial({ color: ch.cape, side: THREE.DoubleSide, roughness: 1 })); cape.position.set(0, 1.0, -.18); cape.rotation.x = .18; g.add(cape);
    // Ausrüstung (unsichtbar bis angelegt)
    const gear = {};
    gear.helm = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 10, 0, 6.3, 0, 1.9), smooth(0x7a5a33)); gear.helm.position.y = 1.68; gear.helm.visible = false; g.add(gear.helm);
    gear.helmIron = new THREE.Mesh(new THREE.ConeGeometry(.3, .5, 8), smooth(0xbfc8d2, { metalness: .7, roughness: .3 })); gear.helmIron.position.y = 1.82; gear.helmIron.visible = false; g.add(gear.helmIron);
    gear.chest = new THREE.Mesh(new THREE.BoxGeometry(.56, .62, .36), smooth(0x7a5a33)); gear.chest.position.y = 1.1; gear.chest.visible = false; g.add(gear.chest);
    gear.chestIron = new THREE.Mesh(new THREE.BoxGeometry(.58, .64, .38), smooth(0xbfc8d2, { metalness: .7, roughness: .3 })); gear.chestIron.position.y = 1.1; gear.chestIron.visible = false; g.add(gear.chestIron);
    gear.shoulders = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), smooth(0xbfc8d2, { metalness: .7, roughness: .3 })); p.position.set(s * .34, 1.42, 0); gear.shoulders.add(p); } gear.shoulders.visible = false; g.add(gear.shoulders);
    gear.boots = boots;
    const sword = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.0, .16), smooth(0xdde6ee, { metalness: .8, roughness: .25 })); blade.position.y = .5; sword.add(blade); const guard = new THREE.Mesh(new THREE.BoxGeometry(.28, .06, .08), smooth(0xf2c14e, { metalness: .7, roughness: .3 })); sword.add(guard); const grip = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .28, 6), smooth(0x3b2a1a)); grip.position.y = -.16; sword.add(grip);
    sword.position.set(.12, 1.0, -.22); sword.rotation.z = -.45; sword.rotation.x = .1; g.add(sword); gear.sword = sword;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(.45, .03, 6, 16, Math.PI), smooth(0x6b4426)); bow.position.set(-.1, 1.1, -.24); bow.rotation.z = Math.PI / 2; bow.visible = false; g.add(bow); gear.bow = bow;
    const hammer = new THREE.Group(); const hh = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 6), smooth(0x5a3b22)); hh.position.y = .4; hammer.add(hh); const hd = new THREE.Mesh(new THREE.BoxGeometry(.3, .22, .22), smooth(0x5e7a3a)); hd.position.y = .9; hammer.add(hd); hammer.position.set(.14, .9, -.24); hammer.rotation.z = -.4; hammer.visible = false; g.add(hammer); gear.hammer = hammer;
    g.userData = { arms, legs, cape, gear, torso }; return g;
  }
  function buildTroll() {
    const g = new THREE.Group(); const skinM = mat(0x5e7a3a), skin2 = mat(0x4c6530);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), skinM); body.scale.set(1, 1.15, .9); body.position.y = 2.2; body.castShadow = true; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), mat(0x8a9a5a)); belly.scale.set(.9, .8, .6); belly.position.set(0, 1.9, .9); g.add(belly);
    const head = new THREE.Group(); const skull = new THREE.Mesh(new THREE.SphereGeometry(.9, 12, 10), skinM); skull.castShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, .8), skin2); jaw.position.set(0, -.55, .3); head.add(jaw);
    for (const s of [-1, 1]) { const tusk = new THREE.Mesh(new THREE.ConeGeometry(.1, .45, 6), mat(0xf4ecd8)); tusk.position.set(s * .4, -.3, .65); tusk.rotation.x = -.3; head.add(tusk); const eye = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb13d, emissiveIntensity: 1.5 })); eye.position.set(s * .35, .2, .8); head.add(eye); const ear = new THREE.Mesh(new THREE.ConeGeometry(.25, .6, 5), skinM); ear.position.set(s * .95, .3, 0); ear.rotation.z = -s * 1.4; head.add(ear); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), skin2); nose.position.set(0, -.05, .9); head.add(nose);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), mat(0x3f8a3a)); m.position.set((i - 2) * .35, .85, -.2 + Math.random() * .3); head.add(m); }
    head.position.set(0, 4.0, .3); g.add(head);
    const arms = []; for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 1.5, 3.0, 0); const up = limb(1.5, .4, skinM); up.rotation.z = -s * .5; sh.add(up); const fist = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), skin2); fist.position.set(-s * .7, -1.5, 0); sh.add(fist); g.add(sh); arms.push(sh); }
    const club = new THREE.Mesh(new THREE.CylinderGeometry(.35, .18, 2.6, 7), mat(0x6b4426)); club.position.set(2.4, 2.0, .4); club.rotation.z = -.5; club.castShadow = true; g.add(club);
    for (const s of [-1, 1]) { const leg = limb(1.3, .5, skin2); leg.position.set(s * .7, 1.3, 0); g.add(leg); const foot = new THREE.Mesh(new THREE.BoxGeometry(.9, .35, 1.2), skin2); foot.position.set(s * .7, .18, .2); g.add(foot); }
    g.userData = { head, arms, body }; return g;
  }
  function buildWolf(alpha) {
    const g = new THREE.Group(); const fur = smooth(alpha ? 0x3a3a44 : 0x6d6f78), fur2 = smooth(alpha ? 0x6a6a78 : 0x9a9ca3); const s = alpha ? 1.5 : 1;
    const body = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 8), fur); body.scale.set(1, .85, 1.9); body.position.y = .75; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), fur); head.position.set(0, 1.0, .85); g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, .35), fur2); snout.position.set(0, .93, 1.15); g.add(snout);
    for (const sd of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.08, .22, 5), fur); ear.position.set(sd * .15, 1.28, .8); g.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(.04, 6, 6), new THREE.MeshStandardMaterial({ color: alpha ? 0xff5555 : 0xffcc66, emissive: alpha ? 0xff2222 : 0xffaa33, emissiveIntensity: 1 })); eye.position.set(sd * .13, 1.06, 1.08); g.add(eye); }
    const legs = []; for (const [x, z] of [[-.22, .55], [.22, .55], [-.22, -.5], [.22, -.5]]) { const hip = new THREE.Group(); hip.position.set(x, .7, z); hip.add(limb(.65, .09, fur)); g.add(hip); legs.push({ hip, knee: hip }); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.1, .7, 6), fur2); tail.position.set(0, .95, -.95); tail.rotation.x = -1.2; g.add(tail);
    g.scale.setScalar(s); g.userData = { legs, tail, alpha, alive: true }; return g;
  }
  function buildNpc() {
    const g = buildHero({ hair: 0x8a6a4a, cloth: 0x4f6b3a, cloth2: 0x3b2f22, cape: 0x6b4426, style: 'long' });
    const hat = new THREE.Mesh(new THREE.ConeGeometry(.4, .6, 10), smooth(0x4a3a2a)); hat.position.y = 2.2; hat.rotation.z = .12; g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .05, 16), smooth(0x4a3a2a)); brim.position.y = 1.93; g.add(brim);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(.15, .42, 8), smooth(0x8a6a4a)); beard.position.set(0, 1.5, .18); beard.rotation.x = Math.PI; g.add(beard);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 2.3, 8), barkMat); staff.position.set(.45, 1.05, .1); g.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0x7cff9b, emissive: 0x7cff9b, emissiveIntensity: 1.2 })); orb.position.set(.45, 2.25, .1); g.add(orb);
    const marker = new THREE.Mesh(new THREE.ConeGeometry(.18, .45, 4), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb13d, emissiveIntensity: 1 })); marker.position.y = 2.95; marker.rotation.x = Math.PI; g.add(marker); g.userData.marker = marker;
    g.userData.gear.sword.visible = false; return g;
  }

  // ===== Detaillierte Figuren (überschreiben die einfachen Versionen oben) =====
  const sph = (r, ws = 20, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
  const skinMat = () => new THREE.MeshStandardMaterial({ color: 0xf2c8a2, roughness: .62 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: .2 });
  const metal = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: .85, roughness: .28 });
  const leather = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  function jointLimb(len, r1, r2, m) { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 12), m); s.position.y = -len / 2; s.castShadow = true; g.add(s); const cap = new THREE.Mesh(sph(r1, 12, 10), m); g.add(cap); return g; }

  function buildHero(ch) {
    const g = new THREE.Group(); const skin = skinMat(), cloth = new THREE.MeshStandardMaterial({ color: ch.cloth, roughness: .7 }), cloth2 = new THREE.MeshStandardMaterial({ color: ch.cloth2, roughness: .75 }), hairM = new THREE.MeshStandardMaterial({ color: ch.hair, roughness: .55 });
    // Rumpf: leicht tailliert, Jacke mit Kragen und Reißverschluss
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.27, .22, .62, 16), cloth); torso.scale.z = .68; torso.position.y = 1.12; torso.castShadow = true; g.add(torso);
    const chestM = new THREE.Mesh(sph(.28, 16, 12), cloth); chestM.scale.set(1, .55, .7); chestM.position.y = 1.4; g.add(chestM);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(.14, .05, 8, 16), cloth2); collar.rotation.x = Math.PI / 2; collar.position.y = 1.5; g.add(collar);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(.02, .5, .02), metal(0xd0d6dc)); zip.position.set(0, 1.12, .19); g.add(zip);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(.235, .235, .07, 16), leather(0x4a3120)); belt.scale.z = .72; belt.position.y = .82; g.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(.08, .06, .03), metal(0xe6c25a)); buckle.position.set(0, .82, .17); g.add(buckle);
    // Hals, Kopf, Gesicht
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .14, 10), skin); neck.position.y = 1.52; g.add(neck);
    const head = new THREE.Mesh(sph(.24, 24, 20), skin); head.scale.set(1, 1.08, .96); head.position.y = 1.74; head.castShadow = true; g.add(head);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(sph(.045, 10, 8), eyeWhite); eye.position.set(s * .085, 1.77, .2); g.add(eye);
      const pupil = new THREE.Mesh(sph(.024, 8, 6), new THREE.MeshStandardMaterial({ color: ch.eyes || 0x2c6fb5, roughness: .2 })); pupil.position.set(s * .085, 1.775, .24); g.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(.08, .014, .02), hairM); brow.position.set(s * .085, 1.84, .215); brow.rotation.z = s * .18; g.add(brow);
      const ear = new THREE.Mesh(sph(.04, 8, 6), skin); ear.scale.z = .5; ear.position.set(s * .235, 1.75, 0); g.add(ear);
    }
    const nose = new THREE.Mesh(sph(.028, 8, 6), skin); nose.position.set(0, 1.72, .235); g.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(.06, .012, .01), new THREE.MeshStandardMaterial({ color: 0xa9584a })); mouth.position.set(0, 1.655, .225); g.add(mouth);
    // Haare je Stil
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.255, 24, 18, 0, Math.PI * 2, 0, 1.75), hairM); cap.position.y = 1.78; cap.rotation.x = -.15; g.add(cap);
    if (ch.style === 'spiky') { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(.07, .3, 6), hairM); sp.position.set(Math.cos(a) * .13, 1.98 + Math.random() * .04, Math.sin(a) * .1 - .03); sp.rotation.set(-Math.sin(a) * .9, 0, Math.cos(a) * .9); g.add(sp); } const fringe = new THREE.Mesh(new THREE.ConeGeometry(.06, .22, 5), hairM); fringe.position.set(.08, 1.9, .2); fringe.rotation.x = 1.1; g.add(fringe); }
    if (ch.style === 'pony') { const tail = new THREE.Mesh(new THREE.CylinderGeometry(.07, .03, .55, 10), hairM); tail.position.set(0, 1.62, -.3); tail.rotation.x = .45; g.add(tail); const band = new THREE.Mesh(new THREE.TorusGeometry(.06, .015, 6, 12), new THREE.MeshStandardMaterial({ color: 0xff5c8a })); band.position.set(0, 1.86, -.2); band.rotation.x = .4; g.add(band); for (const s of [-1, 1]) { const str = new THREE.Mesh(new THREE.ConeGeometry(.035, .3, 5), hairM); str.position.set(s * .2, 1.68, .12); str.rotation.x = Math.PI; g.add(str); } }
    if (ch.style === 'long') { const back = new THREE.Mesh(new THREE.CylinderGeometry(.22, .18, .5, 14, 1, false, Math.PI * .6, Math.PI * 1.8), hairM); back.position.set(0, 1.5, -.02); g.add(back); for (const s of [-1, 1]) { const str = new THREE.Mesh(new THREE.ConeGeometry(.05, .45, 6), hairM); str.position.set(s * .22, 1.6, .05); str.rotation.x = Math.PI; g.add(str); } }
    // Arme mit Ellbogen, Handschuhe
    const arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * .3, 1.43, 0); const pad = new THREE.Mesh(sph(.085, 12, 10), cloth); sh.add(pad); const up = jointLimb(.3, .07, .06, cloth); sh.add(up); const el = new THREE.Group(); el.position.y = -.3; const lo = jointLimb(.3, .06, .05, cloth); el.add(lo); const glove = new THREE.Mesh(sph(.065, 10, 8), leather(0x3a2a1f)); glove.scale.y = 1.25; glove.position.y = -.33; el.add(glove); up.add(el); sh.userData.elbow = el; g.add(sh); arms.push(sh); }
    // Beine mit Knien, Stiefel mit Sohle
    const legs = [], boots = [];
    for (const s of [-1, 1]) { const hp = new THREE.Group(); hp.position.set(s * .11, .84, 0); const up = jointLimb(.36, .095, .08, cloth2); hp.add(up); const kn = new THREE.Group(); kn.position.y = -.36; const lo = jointLimb(.34, .08, .065, cloth2); kn.add(lo); const boot = new THREE.Mesh(new THREE.BoxGeometry(.15, .18, .26), leather(0x3b2a1a)); boot.position.set(0, -.3, .04); kn.add(boot); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.085, .09, .16, 12), leather(0x3b2a1a)); shaft.position.y = -.24; kn.add(shaft); const sole = new THREE.Mesh(new THREE.BoxGeometry(.16, .04, .28), new THREE.MeshStandardMaterial({ color: 0x1d1511 })); sole.position.set(0, -.4, .05); kn.add(sole); up.add(kn); hp.userData.knee = kn; g.add(hp); legs.push(hp); boots.push(boot, shaft); }
    // Umhang (wird animiert)
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(.6, .9, 4, 8), new THREE.MeshStandardMaterial({ color: ch.cape, side: THREE.DoubleSide, roughness: .9 })); cape.geometry.translate(0, -.45, 0); cape.position.set(0, 1.48, -.2); cape.rotation.x = .12; g.add(cape);
    const clasp = new THREE.Mesh(sph(.03, 8, 6), metal(0xe6c25a)); clasp.position.set(0, 1.5, .15); g.add(clasp);
    // Ausrüstung (unsichtbar bis angelegt)
    const gear = {};
    gear.helm = new THREE.Mesh(new THREE.SphereGeometry(.27, 20, 14, 0, Math.PI * 2, 0, 1.9), leather(0x7a5a33)); gear.helm.position.y = 1.8; gear.helm.visible = false; g.add(gear.helm);
    gear.helmIron = new THREE.Group(); { const dome = new THREE.Mesh(new THREE.SphereGeometry(.275, 20, 14, 0, Math.PI * 2, 0, 1.6), metal(0xc3ccd6)); dome.position.y = 1.8; gear.helmIron.add(dome); const nasal = new THREE.Mesh(new THREE.BoxGeometry(.03, .18, .03), metal(0xc3ccd6)); nasal.position.set(0, 1.74, .25); gear.helmIron.add(nasal); const crest = new THREE.Mesh(new THREE.BoxGeometry(.03, .08, .3), new THREE.MeshStandardMaterial({ color: 0xb8243a })); crest.position.y = 2.06; gear.helmIron.add(crest); } gear.helmIron.visible = false; g.add(gear.helmIron);
    gear.chest = new THREE.Mesh(new THREE.CylinderGeometry(.285, .235, .66, 16), leather(0x7a5a33)); gear.chest.scale.z = .72; gear.chest.position.y = 1.12; gear.chest.visible = false; g.add(gear.chest);
    gear.chestIron = new THREE.Mesh(new THREE.CylinderGeometry(.295, .245, .68, 16), metal(0xc3ccd6)); gear.chestIron.scale.z = .74; gear.chestIron.position.y = 1.12; gear.chestIron.visible = false; g.add(gear.chestIron);
    gear.shoulders = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10, 0, Math.PI * 2, 0, 1.7), metal(0xc3ccd6)); p.position.set(s * .32, 1.47, 0); p.rotation.z = -s * .4; gear.shoulders.add(p); } gear.shoulders.visible = false; g.add(gear.shoulders);
    gear.boots = boots;
    const sword = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.0, .14), metal(0xdfe6ee)); blade.position.y = .5; sword.add(blade); const tip = new THREE.Mesh(new THREE.ConeGeometry(.07, .16, 4), metal(0xdfe6ee)); tip.position.y = 1.07; tip.rotation.y = Math.PI / 4; sword.add(tip); const guard = new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .08), metal(0xe6c25a)); sword.add(guard); const grip = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .26, 8), leather(0x3b2a1a)); grip.position.y = -.15; sword.add(grip); const pommel = new THREE.Mesh(sph(.045, 8, 6), metal(0xe6c25a)); pommel.position.y = -.3; sword.add(pommel);
    sword.position.set(.14, 1.05, -.24); sword.rotation.z = -.45; sword.rotation.x = .1; g.add(sword); gear.sword = sword;
    const bow = new THREE.Group(); const arc = new THREE.Mesh(new THREE.TorusGeometry(.5, .025, 8, 24, Math.PI), leather(0x6b4426)); bow.add(arc); const str = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1, 4), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); str.position.x = 0; bow.add(str); bow.position.set(-.12, 1.1, -.26); bow.rotation.z = Math.PI / 2; bow.visible = false; g.add(bow); gear.bow = bow;
    const hammer = new THREE.Group(); const hh = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, 1, 8), leather(0x5a3b22)); hh.position.y = .4; hammer.add(hh); const hd = new THREE.Mesh(new THREE.BoxGeometry(.34, .24, .24), new THREE.MeshStandardMaterial({ color: 0x5e7a3a, roughness: .9 })); hd.position.y = .9; hammer.add(hd); hammer.position.set(.14, .9, -.26); hammer.rotation.z = -.4; hammer.visible = false; g.add(hammer); gear.hammer = hammer;
    g.userData = { arms, legs, cape, gear, torso }; return g;
  }

  function buildTiger() {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0xd9741c, roughness: .85 }), cream = new THREE.MeshStandardMaterial({ color: 0xf6e2c4, roughness: .85 }), black = new THREE.MeshStandardMaterial({ color: 0x1a120b, roughness: .8 });
    const body = new THREE.Mesh(sph(.62, 28, 20), fur); body.scale.set(1.05, .9, 1.75); body.position.set(0, 1.08, 0); body.castShadow = true; g.add(body);
    const shoulders = new THREE.Mesh(sph(.6, 24, 18), fur); shoulders.scale.set(1.1, 1, 1); shoulders.position.set(0, 1.18, .8); shoulders.castShadow = true; g.add(shoulders);
    const hips = new THREE.Mesh(sph(.55, 24, 18), fur); hips.scale.set(1.05, .95, 1); hips.position.set(0, 1.12, -.8); g.add(hips);
    const belly = new THREE.Mesh(sph(.52, 20, 14), cream); belly.scale.set(.85, .6, 1.7); belly.position.set(0, .85, 0); g.add(belly);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.3, .4, .5, 16), fur); neck.rotation.x = -1.0; neck.position.set(0, 1.42, 1.25); g.add(neck);
    // Kopf
    const head = new THREE.Group();
    const skull = new THREE.Mesh(sph(.44, 28, 22), fur); skull.scale.set(1, .92, .95); skull.castShadow = true; head.add(skull);
    const cheekL = new THREE.Mesh(sph(.2, 14, 10), cream), cheekR = cheekL.clone(); cheekL.position.set(-.2, -.14, .3); cheekR.position.set(.2, -.14, .3); head.add(cheekL, cheekR);
    const muzzle = new THREE.Mesh(sph(.2, 16, 12), cream); muzzle.scale.set(1.15, .7, 1); muzzle.position.set(0, -.1, .42); head.add(muzzle);
    const bridge = new THREE.Mesh(sph(.16, 14, 10), fur); bridge.scale.set(.9, .6, 1.3); bridge.position.set(0, .05, .36); head.add(bridge);
    const nose = new THREE.Mesh(sph(.065, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: .35 })); nose.scale.set(1.3, .8, .8); nose.position.set(0, -.04, .6); head.add(nose);
    const chin = new THREE.Mesh(sph(.12, 10, 8), cream); chin.position.set(0, -.26, .4); head.add(chin);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(sph(.075, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd6a63a, roughness: .2 })); eye.position.set(s * .19, .12, .36); head.add(eye);
      const pupil = new THREE.Mesh(sph(.035, 8, 6), pupilMat); pupil.position.set(s * .19, .12, .425); head.add(pupil);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.14, .22, 10), fur); ear.position.set(s * .3, .4, -.05); ear.rotation.z = -s * .35; head.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(.08, .14, 8), cream); inner.position.set(s * .3, .4, -.02); inner.rotation.z = -s * .35; head.add(inner);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(.12, .025, .04), black); brow.position.set(s * .2, .24, .32); brow.rotation.z = s * .4; head.add(brow);
      for (let w = 0; w < 3; w++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .45, 4), new THREE.MeshStandardMaterial({ color: 0xf8f0e0 })); wh.position.set(s * .25, -.1 - w * .03, .5); wh.rotation.z = s * (1.3 + w * .15); wh.rotation.y = s * .3; head.add(wh); }
      const cheekStripe = new THREE.Mesh(new THREE.BoxGeometry(.03, .16, .05), black); cheekStripe.position.set(s * .36, .02, .2); cheekStripe.rotation.z = s * .5; head.add(cheekStripe);
    }
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(.03, .18, .05), black); st.position.set((i - 1) * .12, .3, .3); st.rotation.x = -.6; head.add(st); }
    head.position.set(0, 1.62, 1.5); g.add(head);
    // Streifen als gebogene Bänder über den Rücken
    for (let i = 0; i < 9; i++) { for (const s of [-1, 1]) { const band = new THREE.Mesh(new THREE.TorusGeometry(.58, .035, 6, 14, .9), black); band.position.set(0, 1.12, .95 - i * .24); band.rotation.y = s > 0 ? -.2 : Math.PI + .2; band.rotation.z = Math.PI / 2 - .1; band.scale.set(s, 1, 1); g.add(band); } }
    // Sattel + Decke
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.25, .08, 1.1), new THREE.MeshStandardMaterial({ color: 0x8b1f3a, roughness: .9 })); blanket.position.set(0, 1.5, .05); g.add(blanket);
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .25, 18, 1, false, 0, Math.PI), leather(0x5a3a22)); saddle.rotation.z = Math.PI / 2; saddle.rotation.y = Math.PI / 2; saddle.scale.set(1, 1.1, .9); saddle.position.set(0, 1.5, .05); g.add(saddle);
    const horn = new THREE.Mesh(sph(.06, 8, 6), metal(0xe6c25a)); horn.position.set(0, 1.78, .45); g.add(horn);
    for (const s of [-1, 1]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(.6, .03, 6, 20), leather(0x3a2616)); strap.position.set(0, 1.1, .05); strap.rotation.y = Math.PI / 2; g.add(strap); const stirrup = new THREE.Mesh(new THREE.TorusGeometry(.08, .015, 6, 12), metal(0xc3ccd6)); stirrup.position.set(s * .62, .95, .15); g.add(stirrup); }
    // Beine mit Oberschenkel, Unterschenkel, Pfoten mit Zehen
    const legs = [];
    for (const [x, z, front] of [[-.38, .8, 1], [.38, .8, 1], [-.36, -.7, 0], [.36, -.7, 0]]) {
      const hip = new THREE.Group(); hip.position.set(x, 1.05, z);
      const thigh = new THREE.Mesh(sph(front ? .22 : .27, 14, 12), fur); thigh.scale.set(.8, 1.1, 1); hip.add(thigh);
      const up = jointLimb(.55, .17, .13, fur); hip.add(up);
      const knee = new THREE.Group(); knee.position.y = -.55; const lo = jointLimb(.5, .13, .11, fur); knee.add(lo);
      const paw = new THREE.Mesh(sph(.16, 12, 10), cream); paw.scale.set(1.1, .6, 1.4); paw.position.set(0, -.5, .05); knee.add(paw);
      for (let t = 0; t < 3; t++) { const toe = new THREE.Mesh(sph(.055, 8, 6), cream); toe.position.set((t - 1) * .1, -.53, .25); knee.add(toe); }
      for (let st = 0; st < 2; st++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.15 - st * .02, .025, 6, 12, Math.PI), black); ring.position.set(0, -.15 - st * .22, 0); ring.rotation.y = Math.PI / 2; ring.rotation.z = Math.PI / 2; ring.rotation.x = Math.PI / 2; hip.add(ring); }
      up.add(knee); hip.userData.knee = knee; g.add(hip); legs.push({ hip, knee });
    }
    // Schwanz: 8 Glieder, schwarze Spitze
    const tail = new THREE.Group(); tail.position.set(0, 1.3, -1.35); let parent = tail;
    for (let i = 0; i < 8; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(.055 - i * .004, .06 - i * .004, .26, 10), i >= 6 ? black : (i % 2 ? black : fur)); seg.geometry.rotateX(Math.PI / 2); seg.position.z = -.13; const j = new THREE.Group(); j.add(seg); j.position.z = i ? -.26 : 0; j.rotation.x = -.18; parent.add(j); parent = j; }
    g.add(tail); g.userData = { legs, tail, head, seatY: 1.6, heroY: 1.2, landSpeed: 13, waterSpeed: 2.8 }; return g;
  }

  function buildWolf(alpha) {
    const g = new THREE.Group(); const s = alpha ? 1.5 : 1;
    const fur = new THREE.MeshStandardMaterial({ color: alpha ? 0x2e2e38 : 0x6d6f78, roughness: .9 }), fur2 = new THREE.MeshStandardMaterial({ color: alpha ? 0x55556a : 0xa3a5ad, roughness: .9 });
    const body = new THREE.Mesh(sph(.42, 20, 14), fur); body.scale.set(1, .85, 1.8); body.position.y = .78; body.castShadow = true; g.add(body);
    const chestM = new THREE.Mesh(sph(.42, 18, 14), fur); chestM.position.set(0, .85, .55); g.add(chestM);
    const ruff = new THREE.Mesh(sph(.4, 16, 12), fur2); ruff.scale.set(1, .8, .7); ruff.position.set(0, .95, .7); g.add(ruff);
    const belly = new THREE.Mesh(sph(.3, 14, 10), fur2); belly.scale.set(.9, .6, 1.6); belly.position.set(0, .62, 0); g.add(belly);
    const head = new THREE.Group();
    const skull = new THREE.Mesh(sph(.28, 20, 16), fur); skull.scale.set(1, .9, 1); head.add(skull);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, .34, 12), fur); snout.rotation.x = Math.PI / 2; snout.position.set(0, -.06, .33); head.add(snout);
    const jaw = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .3, 10), fur2); jaw.rotation.x = Math.PI / 2; jaw.position.set(0, -.14, .3); head.add(jaw);
    const nose = new THREE.Mesh(sph(.05, 8, 6), pupilMat); nose.position.set(0, -.02, .52); head.add(nose);
    for (const sd of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.08, .24, 8), fur); ear.position.set(sd * .15, .3, -.02); ear.rotation.z = -sd * .25; head.add(ear); const eye = new THREE.Mesh(sph(.045, 10, 8), new THREE.MeshStandardMaterial({ color: alpha ? 0xff3b3b : 0xffc44d, emissive: alpha ? 0xff1a1a : 0xff9a1a, emissiveIntensity: .9 })); eye.position.set(sd * .12, .08, .22); head.add(eye); for (let t = 0; t < 2; t++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(.012, .05, 4), eyeWhite); tooth.position.set(sd * (.05 + t * .03), -.12, .42 - t * .04); tooth.rotation.x = Math.PI; head.add(tooth); } }
    head.position.set(0, 1.05, .95); g.add(head);
    const legs = [];
    for (const [x, z] of [[-.2, .55], [.2, .55], [-.2, -.5], [.2, -.5]]) { const hip = new THREE.Group(); hip.position.set(x, .72, z); const th = new THREE.Mesh(sph(.14, 10, 8), fur); th.scale.y = 1.3; hip.add(th); const up = jointLimb(.35, .09, .07, fur); hip.add(up); const kn = new THREE.Group(); kn.position.y = -.35; const lo = jointLimb(.32, .07, .06, fur); kn.add(lo); const paw = new THREE.Mesh(sph(.08, 8, 6), fur2); paw.scale.set(1, .6, 1.3); paw.position.y = -.32; kn.add(paw); up.add(kn); g.add(hip); legs.push({ hip, knee: kn }); }
    const tail = new THREE.Group(); tail.position.set(0, .95, -.95); let parent = tail;
    for (let i = 0; i < 5; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(.07 - i * .008, .08 - i * .008, .22, 8), i === 4 ? fur2 : fur); seg.geometry.rotateX(Math.PI / 2); seg.position.z = -.11; const j = new THREE.Group(); j.add(seg); j.position.z = i ? -.22 : 0; j.rotation.x = -.25; parent.add(j); parent = j; }
    g.add(tail); g.scale.setScalar(s); g.userData = { legs, tail, alpha, alive: true }; return g;
  }

  const troll = buildTroll(); troll.position.set(CAVE.x + 2, groundY(CAVE.x + 2, CAVE.z), CAVE.z); troll.rotation.y = -Math.PI / 2; scene.add(troll);
  const trollLight = new THREE.PointLight(0xff6a3d, 1.6, 14, 2); trollLight.position.set(CAVE.x - 2, groundY(CAVE.x, CAVE.z) + 3, CAVE.z); scene.add(trollLight);
  // Troll-Krieger mit Waffen (Keule, Axt, Speer)
  function buildGrunt(weapon) {
    const g = new THREE.Group(); const skinG = new THREE.MeshStandardMaterial({ color: 0x6f8f45, roughness: .85 }), skinD = new THREE.MeshStandardMaterial({ color: 0x55703a, roughness: .85 });
    const body = new THREE.Mesh(sph(.52, 20, 16), skinG); body.scale.set(1, 1.1, .85); body.position.y = 1.15; body.castShadow = true; g.add(body);
    const belly = new THREE.Mesh(sph(.4, 16, 12), new THREE.MeshStandardMaterial({ color: 0x9aa86a, roughness: .9 })); belly.scale.set(.9, .8, .6); belly.position.set(0, 1.0, .3); g.add(belly);
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(.46, .5, .35, 12, 1, true), leather(0x5a3a22)); cloth.position.y = .72; g.add(cloth);
    const head = new THREE.Group(); const skull = new THREE.Mesh(sph(.36, 20, 16), skinG); skull.scale.set(1, .95, 1); head.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(.5, .22, .34), skinD); jaw.position.set(0, -.24, .14); head.add(jaw);
    for (const s of [-1, 1]) { const tusk = new THREE.Mesh(new THREE.ConeGeometry(.045, .2, 6), new THREE.MeshStandardMaterial({ color: 0xf4ecd8 })); tusk.position.set(s * .16, -.12, .3); tusk.rotation.x = -.3; head.add(tusk); const eye = new THREE.Mesh(sph(.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb13d, emissiveIntensity: 1.2 })); eye.position.set(s * .15, .08, .3); head.add(eye); const pupil = new THREE.Mesh(sph(.03, 8, 6), pupilMat); pupil.position.set(s * .15, .08, .365); head.add(pupil); const ear = new THREE.Mesh(new THREE.ConeGeometry(.1, .3, 6), skinG); ear.position.set(s * .4, .1, 0); ear.rotation.z = -s * 1.35; head.add(ear); }
    const nose = new THREE.Mesh(sph(.09, 8, 6), skinD); nose.position.set(0, -.02, .36); head.add(nose);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(.38, 16, 12, 0, Math.PI * 2, 0, 1.4), metal(0x6b6f74)); helm.position.y = .08; head.add(helm); const spike = new THREE.Mesh(new THREE.ConeGeometry(.05, .2, 6), metal(0x8a8f94)); spike.position.y = .5; head.add(spike);
    head.position.set(0, 1.9, .1); g.add(head);
    const arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * .55, 1.5, 0); const pad = new THREE.Mesh(sph(.16, 12, 10), skinG); sh.add(pad); const up = jointLimb(.45, .13, .11, skinG); sh.add(up); const el = new THREE.Group(); el.position.y = -.45; el.add(jointLimb(.4, .11, .09, skinG)); const fist = new THREE.Mesh(sph(.13, 10, 8), skinD); fist.position.y = -.42; el.add(fist); up.add(el); sh.userData.elbow = el; g.add(sh); arms.push(sh); if (s === 1) { const w = new THREE.Group(); if (weapon === 'club') { const h = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 1.0, 8), leather(0x5a3b22)); h.position.y = .3; w.add(h); const kn = new THREE.Mesh(sph(.17, 10, 8), leather(0x6b4426)); kn.position.y = .85; w.add(kn); for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(.03, .14, 5), metal(0x8a8f94)); const a = k / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * .17, .85, Math.sin(a) * .17); sp.rotation.z = -Math.cos(a) * 1.57; sp.rotation.x = Math.sin(a) * 1.57; w.add(sp); } } else if (weapon === 'axe') { const h = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.1, 8), leather(0x5a3b22)); h.position.y = .35; w.add(h); const bl = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 16, 1, false, 0, Math.PI), metal(0xb8c0c8)); bl.rotation.z = Math.PI / 2; bl.rotation.y = Math.PI / 2; bl.position.set(.12, .85, 0); w.add(bl); } else { const h = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.8, 8), leather(0x5a3b22)); h.position.y = .5; w.add(h); const tip = new THREE.Mesh(new THREE.ConeGeometry(.07, .35, 6), metal(0xb8c0c8)); tip.position.y = 1.55; w.add(tip); } w.position.set(0, -.42, .1); w.rotation.x = -.3; el.add(w); } }
    const legs = [];
    for (const s of [-1, 1]) { const hp = new THREE.Group(); hp.position.set(s * .22, .75, 0); const up = jointLimb(.35, .15, .12, skinG); hp.add(up); const kn = new THREE.Group(); kn.position.y = -.35; kn.add(jointLimb(.3, .12, .1, skinG)); const foot = new THREE.Mesh(new THREE.BoxGeometry(.22, .14, .36), skinD); foot.position.set(0, -.32, .08); kn.add(foot); up.add(kn); g.add(hp); legs.push({ hip: hp, knee: kn }); }
    g.scale.setScalar(.95); g.userData = { legs, tail: new THREE.Group(), arms, head, kind: 'grunt', weapon, alive: true }; return g;
  }
  const wolves = [];
  for (let i = 0; i < 18; i++) { const w = buildGrunt(i === 0 ? 'axe' : ['club', 'axe', 'spear'][i % 3]); if (i === 0) { w.userData.kind = 'alpha'; w.userData.alpha = true; w.scale.setScalar(1.45); w.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0x6f8f45) o.material = new THREE.MeshStandardMaterial({ color: 0x4e6b3a, roughness: .85 }); }); const crown = new THREE.Mesh(new THREE.CylinderGeometry(.42, .38, .22, 8, 1, true), metal(0xe6c25a)); crown.position.set(0, 2.42, .1); w.add(crown); } if (i > 0 && i % 4 === 3) { w.userData.kind = 'imp'; } w.userData.hp = i === 0 ? 150 : w.userData.kind === 'imp' ? 55 : 75; w.userData.maxHp = w.userData.hp; let x, z; do { x = rng(-170, 170); z = rng(-170, 170); } while (Math.hypot(x, z) < 22 || inWater(x, z) || groundY(x, z) > TREELINE); w.position.set(x, groundY(x, z), z); w.userData.dir = Math.random() * 6; w.userData.t = Math.random() * 5; scene.add(w); wolves.push(w); }
  const npc = buildNpc(); npc.position.set(-2, groundY(-2, 2), 2); npc.rotation.y = 2.3; scene.add(npc);

  const player = new THREE.Group(); scene.add(player);
  let mountMesh = buildTiger(); player.add(mountMesh);
  let hero = buildHero(CHARS[0]); player.add(hero);
  const mountFree = new THREE.Group(); scene.add(mountFree); // abgestelltes Reittier
  function setRiding() { hero.position.set(0, mountMesh.userData.seatY, .1); hero.scale.setScalar(.95); hero.userData.legs.forEach((l, i) => { l.rotation.x = -1.1; l.rotation.z = (i ? 1 : -1) * .55; if (l.userData.knee) l.userData.knee.rotation.x = 1.3; }); hero.userData.arms.forEach(a => { a.rotation.x = -.5; if (a.userData.elbow) a.userData.elbow.rotation.x = -.6; }); }
  function setWalking() { hero.position.set(0, 0, 0); hero.scale.setScalar(1); hero.userData.legs.forEach(l => { l.rotation.set(0, 0, 0); if (l.userData.knee) l.userData.knee.rotation.set(0, 0, 0); }); hero.userData.arms.forEach(a => { a.rotation.set(0, 0, 0); if (a.userData.elbow) a.userData.elbow.rotation.set(0, 0, 0); }); }
  function rebuildHero() { player.remove(hero); hero = buildHero(CHARS[state.charIdx]); player.add(hero); applyGear(hero); state.mounted ? setRiding() : setWalking(); }
  function setMount(kind) { const wasIn = mountMesh.parent; wasIn.remove(mountMesh); mountMesh = kind === 'tiger' ? buildTiger() : buildTurtle(); wasIn.add(mountMesh); if (state.mounted) setRiding(); }
  setRiding();

  const ffGeo = new THREE.BufferGeometry(); const fp = []; for (let i = 0; i < 140; i++) fp.push(rng(-45, 45), 2 + Math.random() * 3, rng(-45, 45)); ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  const mist = []; (function () { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); const gr = c.createRadialGradient(64, 32, 4, 64, 32, 60); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(.5, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 64); const tex = new THREE.CanvasTexture(cv); const mm = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: .12, depthWrite: false, fog: true }); for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(mm); s.scale.set(rng(12, 22), rng(3.5, 6), 1); s.userData = { ox: rng(-50, 50), oz: rng(-50, 50), v: rng(.2, .6) }; scene.add(s); mist.push(s); } mist.mat = mm; })();
  const wisp = new THREE.Group(); (function () { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(170,235,255,.9)'); g.addColorStop(.6, 'rgba(120,200,255,.3)'); g.addColorStop(1, 'rgba(120,200,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(.9, .9, 1); wisp.add(sp); wisp.userData.sp = sp; const l = new THREE.PointLight(0x8fd8ff, 1.4, 7, 2); wisp.add(l); wisp.userData.l = l; wisp.position.set(-1.5, 2.5, -1.5); scene.add(wisp); wisp.userData.coinT = 150; wisp.userData.tgtChest = null; })();
  const pollenGeo = new THREE.BufferGeometry(); const pp = []; for (let i = 0; i < 260; i++) pp.push(rng(-30, 30), rng(.5, 7), rng(-30, 30)); pollenGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({ color: 0xfff1b0, size: .09, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); pollen.frustumCulled = false; scene.add(pollen);
  const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xd8ff8a, size: .18, transparent: true, opacity: .9 })); scene.add(fireflies);
  // Schmetterlinge (zwei Flügel, flattern) und fallende Blätter
  const butterflies = [];
  const bfCols = [0xffb13d, 0x7cff9b, 0x9ad8ff, 0xff7aa8, 0xffffff];
  for (let i = 0; i < 24; i++) {
    const b = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: bfCols[i % 5], side: THREE.DoubleSide, roughness: .6, emissive: bfCols[i % 5], emissiveIntensity: .15 });
    const wl = new THREE.Mesh(new THREE.CircleGeometry(.14, 8), m), wr = wl.clone(); wl.position.x = -.12; wr.position.x = .12; wl.geometry = new THREE.CircleGeometry(.14, 8); b.add(wl, wr); b.userData = { wl, wr, ax: rng(-60, 60), az: rng(-60, 60), ph: Math.random() * 10 };
    scene.add(b); butterflies.push(b);
  }
  const leafGeo = new THREE.BufferGeometry(); const lp = [], lv = [];
  for (let i = 0; i < 400; i++) { lp.push(rng(-50, 50), rng(1, 12), rng(-50, 50)); lv.push(Math.random()); }
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: 0xd8c25a, size: .14, transparent: true, opacity: .85 })); scene.add(leaves);

  // ---------- Inventar / Items ----------
  const ITEMS = {
    sword: { icon: '🗡️', name: 'Eisenschwert', type: 'weapon', r: 'blue', atk: 5 },
    bow: { icon: '🏹', name: 'Jagdbogen', type: 'weapon', r: 'blue', atk: 4 },
    hammer: { icon: '🔨', name: 'Trollhammer', type: 'weapon', r: 'purple', atk: 9 },
    heal: { icon: '🧪', name: 'Heiltrank', type: 'use', n: 3 }, bigheal: { icon: '⚗️', name: 'Großer Heiltrank', type: 'use', n: 1 },
    stam: { icon: '🥤', name: 'Ausdauer-Trank', type: 'use', n: 2 }, phoenix: { icon: '🔥', name: 'Phönix-Trank', type: 'use', r: 'gold', n: 1 },
    helmL: { icon: '🪖', name: 'Lederhelm', type: 'helm', r: '', def: 1 }, helmI: { icon: '⛑️', name: 'Eisenhelm', type: 'helm', r: 'blue', def: 3 },
    chestL: { icon: '🦺', name: 'Lederweste', type: 'chest', r: '', def: 2 }, chestI: { icon: '🛡️', name: 'Eisenbrust', type: 'chest', r: 'blue', def: 5 },
    bootsL: { icon: '👢', name: 'Lederstiefel', type: 'boots', r: '', def: 1 }, bootsI: { icon: '🥾', name: 'Eisenstiefel', type: 'boots', r: 'blue', def: 2 },
    tooth: { icon: '🦷', name: 'Trollzahn (Trophäe)', type: 'misc', r: 'gold' }, coin: { icon: '🪙', name: 'Münzbeutel', type: 'misc' }, pelt: { icon: '🐺', name: 'Trollfell', type: 'misc', n: 0 }, key: { icon: '🗝️', name: 'Alter Schlüssel', type: 'misc', r: 'purple' },
    shield: { icon: '🛡️', name: 'Schutzschild', type: 'use', r: 'purple', n: 0, info: 'Der nächste Fehler im Kampf kostet keine HP' }, fire: { icon: '🔥', name: 'Feuerschlag', type: 'use', r: 'purple', n: 0, info: 'Die nächsten 3 Treffer machen 50 % mehr Schaden' }, strength: { icon: '💪', name: 'Stärketrank', type: 'use', r: 'blue', n: 0, info: '10 Minuten lang 30 % mehr Schaden' }, luck: { icon: '🍀', name: 'Glücksamulett', type: 'use', r: 'gold', n: 0, info: '10 Minuten lang doppelte Münzen' }
  };
  const hotbar = ['sword', 'bow', 'heal', 'stam', null, null, null, null, null];
  // Inventar: vier Kategorien mit je 20 Plätzen
  const BAG_CATS = [['weapon', '⚔️', 'Waffen'], ['armor', '🛡️', 'Rüstung'], ['use', '🧪', 'Tränke'], ['misc', '📦', 'Sonstiges']];
  const mk = (arr) => { const a = Array(20).fill(null); arr.forEach((v, i) => a[i] = v); return a; };
  const bags = { weapon: mk([]), armor: mk(['helmL', 'chestL', 'bootsL', 'helmI', 'chestI', 'bootsI']), use: mk(['bigheal', 'phoenix']), misc: mk(['pelt', 'key']) };
  let bagCat = 'armor';
  const catOf = (id) => { const t = ITEMS[id] ? ITEMS[id].type : 'misc'; return t === 'weapon' ? 'weapon' : (t === 'helm' || t === 'chest' || t === 'boots') ? 'armor' : t === 'use' ? 'use' : 'misc'; };
  const bagFor = (id) => bags[catOf(id)];
  const bagCount = (cat) => bags[cat].filter(Boolean).length;
  const equip = { helm: null, chest: null, boots: null, weapon: 'sword' };
  function applyGear(h) {
    const g = h.userData.gear;
    g.helm.visible = equip.helm === 'helmL'; g.helmIron.visible = equip.helm === 'helmI';
    g.chest.visible = equip.chest === 'chestL'; g.chestIron.visible = equip.chest === 'chestI'; g.shoulders.visible = equip.chest === 'chestI';
    g.boots.forEach(b => b.material = smooth(equip.boots === 'bootsI' ? 0xbfc8d2 : equip.boots === 'bootsL' ? 0x7a5a33 : 0x3b2a1a, equip.boots === 'bootsI' ? { metalness: .7, roughness: .3 } : {}));
    g.sword.visible = equip.weapon === 'sword'; g.bow.visible = equip.weapon === 'bow'; g.hammer.visible = equip.weapon === 'hammer';
  }
  function stats() { const def = ['helm', 'chest', 'boots'].reduce((s, k) => s + (equip[k] ? ITEMS[equip[k]].def : 0), 0); const atk = equip.weapon ? ITEMS[equip.weapon].atk : 1; state.maxHp = 100 + def * 8; state.hp = Math.min(state.hp, state.maxHp); $('statAtk').textContent = atk; $('statDef').textContent = def; $('statHp').textContent = state.maxHp; hpUI(); return { atk, def }; }
  // Gezeichnete Item-Icons (SVG)
  const S = (inner) => `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const potion = (c) => S(`<path d="M12 3h8v3h-1v4l6 10a5 5 0 0 1-4 8H11a5 5 0 0 1-4-8l6-10V6h-1z" fill="#dfe9f3" opacity=".35" stroke="#e8f1f8" stroke-width="1.2"/><path d="M8.5 20l4.5-7h6l4.5 7a4 4 0 0 1-3.5 6H12a4 4 0 0 1-3.5-6z" fill="${c}"/><circle cx="19" cy="22" r="1.4" fill="#fff" opacity=".8"/><rect x="12" y="2" width="8" height="3" rx="1" fill="#8a5a33"/>`);
  const ICON = {
    sword: S(`<path d="M6 26l3 3 14-14-3-3z" fill="#dfe6ee"/><path d="M20 12l3 3 5-9-8 6z" fill="#f4f7fa"/><path d="M6 26l3 3-2 1-2-2z" fill="#3b2a1a"/><path d="M9 20l3 3-2 2-3-3z" fill="#e6c25a"/><path d="M4 27l2-2 1 1-2 2z" fill="#e6c25a"/>`),
    bow: S(`<path d="M9 4c10 4 10 20 0 24" fill="none" stroke="#6b4426" stroke-width="2.6" stroke-linecap="round"/><path d="M9 4L9 28" stroke="#f0f0f0" stroke-width="1"/><path d="M8 16h18" stroke="#8a5a33" stroke-width="1.6"/><path d="M26 16l-4-3v6z" fill="#c3ccd6"/><path d="M9 16l4-2v4z" fill="#d84c4c"/>`),
    hammer: S(`<rect x="14" y="12" width="3.5" height="17" rx="1" fill="#5a3b22"/><path d="M6 6h20l-2 8H8z" fill="#5e7a3a"/><path d="M6 6h20v3H6z" fill="#7a9a4a"/><circle cx="11" cy="10" r="1" fill="#2f4a1a"/><circle cx="21" cy="10" r="1" fill="#2f4a1a"/>`),
    heal: potion('#ff4d6d'), bigheal: potion('#ff2a66'), stam: potion('#ffb13d'), phoenix: potion('#ff7a1a'),
    helmL: S(`<path d="M6 18a10 10 0 0 1 20 0v4H6z" fill="#8a6a3f"/><path d="M6 22h20v3H6z" fill="#5a4328"/><path d="M15 10h2v10h-2z" fill="#5a4328"/>`),
    helmI: S(`<path d="M6 18a10 10 0 0 1 20 0v4H6z" fill="#c3ccd6"/><path d="M6 22h20v3H6z" fill="#8f9aa6"/><path d="M15 12h2v12h-2z" fill="#6f7a86"/><path d="M14 4h4l-1 6h-2z" fill="#b8243a"/>`),
    chestL: S(`<path d="M8 6l4-2 4 3 4-3 4 2 2 10-3 1v11H9V17l-3-1z" fill="#8a6a3f"/><path d="M16 7v22" stroke="#5a4328" stroke-width="1.5"/><path d="M9 14h14" stroke="#5a4328" stroke-width="1.2"/>`),
    chestI: S(`<path d="M8 6l4-2 4 3 4-3 4 2 2 10-3 1v11H9V17l-3-1z" fill="#c3ccd6"/><path d="M16 7v22" stroke="#7f8a96" stroke-width="1.5"/><circle cx="9" cy="8" r="3" fill="#dfe6ee"/><circle cx="23" cy="8" r="3" fill="#dfe6ee"/><path d="M12 16l4 6 4-6" fill="none" stroke="#e6c25a" stroke-width="1.5"/>`),
    bootsL: S(`<path d="M9 4h8v12l6 5v5H9z" fill="#8a6a3f"/><path d="M9 24h14v3H9z" fill="#3b2a1a"/><path d="M17 16l6 5" stroke="#5a4328" stroke-width="1.4"/>`),
    bootsI: S(`<path d="M9 4h8v12l6 5v5H9z" fill="#c3ccd6"/><path d="M9 24h14v3H9z" fill="#3b2a1a"/><path d="M9 9h8M9 13h8" stroke="#8f9aa6" stroke-width="1.3"/>`),
    tooth: S(`<path d="M10 5c3-2 9-2 12 0 3 2 3 8 1 12l-2 10c-1 2-3 2-3 0l-1-7h-2l-1 7c0 2-2 2-3 0L9 17C7 13 7 7 10 5z" fill="#f4ecd8"/><path d="M12 8c2-1 6-1 8 0" stroke="#d8ccb0" stroke-width="1.2"/>`),
    coin: S(`<circle cx="16" cy="16" r="11" fill="#e6c25a"/><circle cx="16" cy="16" r="8" fill="none" stroke="#b8942e" stroke-width="1.5"/><path d="M15 10h3l-1 12h-2z" fill="#b8942e"/>`),
    pelt: S(`<path d="M6 10c4-6 16-6 20 0l-3 4 3 6-4 2 1 5-7-3-7 3 1-5-4-2 3-6z" fill="#7a7c85"/><path d="M10 12c3 2 9 2 12 0" stroke="#a3a5ad" stroke-width="1.4"/>`),
    key: S(`<circle cx="10" cy="11" r="6" fill="none" stroke="#e6c25a" stroke-width="3"/><path d="M14 15l12 12M22 23l3-3M19 20l3-3" stroke="#e6c25a" stroke-width="3" stroke-linecap="round"/>`)
  };
  const icon = (id) => ICON[id] || `<span>${ITEMS[id].icon}</span>`;
  function slotHtml(id, idx, extra) { const it = id ? ITEMS[id] : null; return `<div class="slot ${it ? '' : 'empty'} ${it && it.r ? 'r-' + it.r : ''} ${extra || ''}" data-i="${idx}" title="${it ? it.name : ''}">${it ? icon(id) : ''}${extra && extra.startsWith('hb') ? `<small>${idx + 1}</small>` : ''}${it && it.n ? `<span class="n">${it.n}</span>` : ''}</div>`; }
  function renderHotbar() { $('hotbar').innerHTML = hotbar.map((id, i) => slotHtml(id, i, 'hb' + (i === state.hot ? ' sel' : ''))).join(''); $('hotbar').querySelectorAll('.slot').forEach(s => s.addEventListener('click', () => selectHot(+s.dataset.i))); }
  function selectHot(i) { state.hot = i; const id = hotbar[i]; if (id && ITEMS[id].type === 'weapon') { equip.weapon = id; applyGear(hero); stats(); toast(ITEMS[id].name + ' ausgerüstet'); } else if (id && ITEMS[id].type === 'use') useItem(id, hotbar, i); renderHotbar(); }
  function useItem(id, arr, i) { const it = ITEMS[id]; if (id === 'heal' || id === 'bigheal') { state.hp = id === 'heal' ? Math.min(state.maxHp, state.hp + 40) : state.maxHp; hpUI(); toast(id === 'heal' ? '+40 HP' : 'HP voll'); } if (id === 'stam') { state.stamina = 100; toast('Ausdauer voll'); } if (id === 'phoenix') { toast('Phönix-Trank – lieber für den Boss aufheben!'); return; } if (id === 'shield') { state.buffs.shield = 1; toast('🛡️ Schutzschild aktiv – der nächste Fehler kostet keine HP'); } if (id === 'fire') { state.buffs.fire = 3; toast('🔥 Feuerschlag – die nächsten 3 Treffer +50 %'); } if (id === 'strength') { state.buffs.str = Date.now() + 600000; toast('💪 Stärke +30 % für 10 Minuten'); } if (id === 'luck') { state.buffs.luck = Date.now() + 600000; toast('🍀 Doppelte Münzen für 10 Minuten'); } if (it.n > 1) it.n--; else arr[i] = null; renderAll(); }
  function renderBag() {
    $('bagTabs').innerHTML = BAG_CATS.map(([k, ic, n]) => `<button class="tab ${k === bagCat ? 'on' : ''}" data-cat="${k}">${ic} ${n} <span class="cnt">${bagCount(k)}/20</span></button>`).join('');
    $('bagTabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { bagCat = b.dataset.cat; renderBag(); });
    const bag = bags[bagCat];
    $('bag').innerHTML = bag.map((id, i) => slotHtml(id, i)).join('');
    $('bag').querySelectorAll('.slot').forEach(s => s.addEventListener('click', () => { const i = +s.dataset.i, id = bag[i]; if (!id) return; const it = ITEMS[id]; $('bagInfo').textContent = it.name + (it.def ? ' · Rüstung +' + it.def : '') + (it.atk ? ' · Stärke ' + it.atk : ''); if (['helm', 'chest', 'boots'].includes(it.type)) { const old = equip[it.type]; equip[it.type] = id; bag[i] = old; applyGear(hero); if (invHero) applyGear(invHero); stats(); toast(it.name + ' angelegt'); renderAll(); } else if (it.type === 'weapon') { equip.weapon = id; const free = hotbar.indexOf(null); if (free >= 0) { hotbar[free] = id; bag[i] = null; } applyGear(hero); if (invHero) applyGear(invHero); stats(); renderAll(); } else if (it.type === 'use') useItem(id, bag, i); }));
    const names = { helm: 'Helm', chest: 'Brust', boots: 'Stiefel', weapon: 'Waffe' };
    $('equip').innerHTML = Object.keys(names).map(k => `<div class="slot ${equip[k] ? '' : 'empty'} ${equip[k] && ITEMS[equip[k]].r ? 'r-' + ITEMS[equip[k]].r : ''}" data-k="${k}"><small>${names[k]}</small>${equip[k] ? icon(equip[k]) : ''}</div>`).join('');
    $('equip').querySelectorAll('.slot').forEach(s => s.addEventListener('click', () => { const k = s.dataset.k; if (!equip[k] || k === 'weapon') return; const tgt = bagFor(equip[k]); const free = tgt.indexOf(null); if (free < 0) { toast('Rüstungs-Fach voll'); return; } tgt[free] = equip[k]; equip[k] = null; applyGear(hero); if (invHero) applyGear(invHero); stats(); renderAll(); }));
  }
  function hpUI() { const p = clamp(state.hp / state.maxHp * 100, 0, 100) + '%'; $('hpBar').style.width = p; $('hpNum').textContent = Math.round(state.hp) + ' / ' + state.maxHp; $('bHp').style.width = p; $('bHpNum').textContent = Math.round(state.hp) + ' / ' + state.maxHp; }
  let hurtT; function damage(n, why) { if (state.hp <= 0) return; A.sfx('hurt'); state.hp = Math.max(0, state.hp - n); hpUI(); $('hurt').classList.add('on'); clearTimeout(hurtT); hurtT = setTimeout(() => $('hurt').classList.remove('on'), 220); if (why) toast(why); if (state.hp <= 0) { if (battleOn) endBattle(); clearInterval(stTimer); $('station').hidden = true; $('deadWhy').textContent = why ? why.replace(/! −.*$/, '') : 'Im Kampf gefallen'; setTimeout(() => $('dead').classList.add('on'), 400); } }
  function respawn() { $('dead').classList.remove('on'); state.hp = state.maxHp; player.position.set(0, 1.2, 0); heading = Math.PI * .5; if (!state.mounted) { mountFree.position.set(2, 1.2, 3); } hpUI(); show('world'); toast('Wiederbelebt am Lagerfeuer'); }
  function renderAll() { renderHotbar(); renderBag(); hpUI(); $('coins').textContent = state.coins; $('gems').textContent = state.gems || 0; $('lvl').textContent = state.level; $('xp').style.width = (state.xp / state.xpNeed * 100) + '%'; }
  function hearts(el, n, max) { el.innerHTML = Array.from({ length: max }, (_, i) => `<span class="h ${i < n ? '' : 'off'}">♥</span>`).join(''); }
  function gainXp(n) { if (n > 0) { gainSeasonXp(Math.max(1, Math.round(n * .6))); if (hud.classList.contains('on')) popDmg(player, '+' + n + ' XP', 'xp'); } state.xp += n; while (state.xp >= state.xpNeed) { state.xp -= state.xpNeed; state.level++; state.xpNeed = Math.round(state.xpNeed * 1.25); banner('LEVEL ' + state.level, 'HP voll · weiter so!', 'gold'); A.sfx('levelup'); state.hp = state.maxHp; } renderAll(); }
  function addItem(id, n) { const it = ITEMS[id]; const bag = bagFor(id); if (it.n !== undefined) { it.n += n || 1; const idx = bag.indexOf(id); if (idx < 0 && hotbar.indexOf(id) < 0) { const f = bag.indexOf(null); if (f >= 0) bag[f] = id; } } else { const f = bag.indexOf(null); if (f >= 0) bag[f] = id; else toast('Fach „' + BAG_CATS.find(c => c[0] === catOf(id))[2] + '“ voll (20/20)'); } renderAll(); }

  // Inventar-3D-Ansicht
  let invRenderer, invScene, invCam, invHero;
  function initInv() {
    if (invRenderer) return;
    const cv = $('invView'); invRenderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); invRenderer.setPixelRatio(Math.min(devicePixelRatio, 2)); invRenderer.outputEncoding = THREE.sRGBEncoding; invRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    invScene = new THREE.Scene(); invCam = new THREE.PerspectiveCamera(35, 1, .1, 50); invCam.position.set(0, 1.3, 4.2); invCam.lookAt(0, 1.0, 0);
    invScene.add(new THREE.HemisphereLight(0xffffff, 0x334433, 1.1)); const k = new THREE.DirectionalLight(0xfff0d0, 1.4); k.position.set(2, 4, 3); invScene.add(k); const rim = new THREE.DirectionalLight(0x7cff9b, 1); rim.position.set(-3, 2, -3); invScene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .08, 32), new THREE.MeshStandardMaterial({ color: 0x1b3a2a, emissive: 0x7cff9b, emissiveIntensity: .15 })); disc.position.y = -.04; invScene.add(disc);
  }
  function renderInv() { if ($('inventory').hidden) return; const cv = $('invView'); const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w * invRenderer.getPixelRatio()) { invRenderer.setSize(w, h, false); invCam.aspect = w / h; invCam.updateProjectionMatrix(); } if (invHero) { invHero.rotation.y += .01; invHero.userData.cape.rotation.x = .2 + Math.sin(clock.t * 2) * .05; } if (invInst) invInst.obj.rotation.y += .01; invRenderer.render(invScene, invCam); }
  function openInv() { initInv(); if (invHero) invScene.remove(invHero); invHero = buildHero(CHARS[state.charIdx]); applyGear(invHero); invScene.add(invHero); $('invName').textContent = state.name; stats(); renderBag(); $('inventory').hidden = false; }

  // ---------- Quests ----------
  const QUESTS = [
    { id: 'wolves', t: 'Trolljagd', d: 'Besiege 3 Troll-Krieger im Wald', need: 3, xp: 60, coins: 30, item: 'helmL' },
    { id: 'chest', t: 'Die verlorene Truhe', d: 'Finde Brams Truhe (nördlich des Lagers) und öffne sie', need: 1, xp: 40, coins: 20, item: 'key' },
    { id: 'alpha', t: 'Der Troll-Häuptling', d: 'Besiege den Troll-Häuptling (groß, goldene Krone)', need: 1, xp: 120, coins: 60, item: 'chestL' },
    { id: 'troll', t: 'Boss: Waldtroll', d: 'Öffne das Tor der Troll-Höhle (ab Level 10) und besiege den Waldtroll', need: 1, xp: 200, coins: 100, item: 'tooth' }
  ];
  const qstate = {}; QUESTS.forEach(q => qstate[q.id] = { acc: false, prog: 0, done: false });
  let tracked = null;
  function renderQuests() {
    $('qlist').innerHTML = QUESTS.map(q => { const s = qstate[q.id]; return `<div class="q"><div><div class="t">${s.done ? '✅ ' : ''}${q.t}</div><div class="d">${q.d} · ${q.xp} XP · ${q.coins} 🪙 · ${ITEMS[q.item].icon}</div></div>${s.done ? '<span class="tag">Erledigt</span>' : s.acc ? (s.prog >= q.need ? `<button class="btn small primary" data-q="${q.id}" data-a="turn">Abgeben</button>` : `<span class="tag">${s.prog}/${q.need}</span>`) : `<button class="btn small" data-q="${q.id}" data-a="acc">Annehmen</button>`}</div>`; }).join('');
    $('qlist').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const q = QUESTS.find(x => x.id === b.dataset.q), s = qstate[q.id]; if (b.dataset.a === 'acc') { A.sfx('quest'); s.acc = true; tracked = q.id; toast('Quest angenommen: ' + q.t); } else { s.done = true; gainXp(q.xp); state.coins += q.coins; addItem(q.item); toast(`Quest erledigt · +${q.xp} XP · +${q.coins} 🪙 · ${ITEMS[q.item].name}`); if (tracked === q.id) tracked = QUESTS.find(x => qstate[x.id].acc && !qstate[x.id].done)?.id || null; } renderQuests(); updateTracker(); }));
  }
  function updateTracker() { const dt0 = dailyTask(); const de = $('dailyLine'); if (de) de.textContent = dt0 ? (state.daily.done ? '📋 Tagesaufgabe erledigt ✓' : `📋 ${dt0.t} · ${dailyProg()} / ${dt0.n}`) : '📋 Keine Tagesaufgabe gewählt'; const q = QUESTS.find(x => x.id === tracked); if (!q) { $('qtitle').textContent = 'Keine Quest'; $('qprog').textContent = 'Sprich mit Bram im Lager (E)'; npc.userData.marker.visible = true; return; } const s = qstate[q.id]; $('qtitle').textContent = q.t; $('qprog').textContent = s.prog >= q.need ? 'Erledigt · zurück zu Bram' : `${s.prog} / ${q.need} · ${q.d}`; npc.userData.marker.visible = QUESTS.some(x => !qstate[x.id].acc || (qstate[x.id].acc && !qstate[x.id].done && qstate[x.id].prog >= x.need)); }
  function progress(id, n) { const s = qstate[id]; if (s.acc && !s.done) { s.prog = Math.min(QUESTS.find(q => q.id === id).need, s.prog + (n || 1)); updateTracker(); } }

  // ---------- Wetter: klar, bewölkt, Regen, Sturm (Blitze), Schnee – mit Wolkendecke, nassem Boden, Schneedecke ----------
  const WEATHERS = ['clear', 'cloudy', 'rain', 'clear', 'storm', 'cloudy', 'snow', 'clear'];
  const weather = { kind: 'clear', next: 200, t: 0, lightning: 0, flash: 0 };
  const WX = { clear: { cloud: .28, dark: 0, dim: 1, fog: 1, wind: .1, wet: 0, snow: 0 }, cloudy: { cloud: .66, dark: .35, dim: .8, fog: 1.15, wind: .25, wet: 0, snow: 0 }, rain: { cloud: .9, dark: .6, dim: .7, fog: 1.6, wind: .4, wet: 1, snow: 0 }, storm: { cloud: 1, dark: .9, dim: .5, fog: 2, wind: 1, wet: 1, snow: 0 }, snow: { cloud: .92, dark: .35, dim: .8, fog: 1.7, wind: .3, wet: 0, snow: 1 } };
  function streakTex() { const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128; const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.lineWidth = 2.2; c.beginPath(); c.moveTo(16, 0); c.lineTo(16, 128); c.stroke(); return new THREE.CanvasTexture(cv); }
  function flakeTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); }
  const dropGeo = new THREE.BufferGeometry(); const dp = []; for (let i = 0; i < 3200; i++) dp.push(rng(-40, 40), rng(0, 30), rng(-40, 40)); dropGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xd6ebff, size: 1.3, map: streakTex(), transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.Points(dropGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
  const flakeGeo = new THREE.BufferGeometry(); const fp2 = []; for (let i = 0; i < 2200; i++) fp2.push(rng(-40, 40), rng(0, 28), rng(-40, 40)); flakeGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp2, 3));
  const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: .34, map: flakeTex(), transparent: true, opacity: 0, depthWrite: false });
  const snow = new THREE.Points(flakeGeo, snowMat); snow.frustumCulled = false; scene.add(snow);
  // Blitz: gezackte Linie vom Himmel
  const boltMat = new THREE.LineBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0, fog: false }); const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 40), 3));
  const bolt = new THREE.Line(boltGeo, boltMat); bolt.frustumCulled = false; scene.add(bolt);
  const branchGeo = new THREE.BufferGeometry(); branchGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 24), 3)); const branches = new THREE.LineSegments(branchGeo, boltMat); branches.frustumCulled = false; scene.add(branches);
  // Fackel: Stiel, glühender Kopf, Flammen-Sprite, kleines Licht – nachts automatisch in der linken Hand
  const torch = new THREE.Group(); torch.visible = false;
  (function () {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, .9, 7), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 1 })); stick.position.y = .3; torch.add(stick);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.075, .07, .22, 8), new THREE.MeshStandardMaterial({ color: 0x5a3b1a, roughness: .9 })); wrap.position.y = .72; torch.add(wrap);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff5a10, emissiveIntensity: 4, roughness: .6 })); ember.position.y = .86; torch.add(ember);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); const gr = c.createRadialGradient(32, 36, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(.3, 'rgba(255,160,40,.9)'); gr.addColorStop(.7, 'rgba(255,80,10,.35)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flame.position.y = 1.0; flame.scale.set(.8, 1.25, 1); torch.add(flame); torch.userData.flame = flame;
    const light = new THREE.PointLight(0xffb060, 5.5, 26, 1.6); light.position.y = 1.05; torch.add(light); torch.userData.light = light;
    torch.userData.on = false;
  })();
  function setTorch(on) {
    if (torch.userData.on === on) return; torch.userData.on = on; torch.visible = on;
    if (on && heroInst) { let hand = null; heroInst.obj.traverse(o => { if (!hand && /^handslot.?l$/i.test(o.name)) hand = o; }); if (!hand) heroInst.obj.traverse(o => { if (!hand && /^hand.?l$/i.test(o.name)) hand = o; }); if (hand && torch.parent !== hand) { hand.add(torch); torch.position.set(0, 0, 0); torch.rotation.set(0, 0, 0); torch.scale.setScalar(1 / .75); } }
    if (heroInst) heroInst.obj.traverse(o => { if (/Shield|Spellbook|Offhand/.test(o.name) && o.isMesh) o.visible = on ? false : o.userData.wasVisible !== undefined ? o.userData.wasVisible : o.visible; if (on && o.isMesh && /Shield|Spellbook|Offhand/.test(o.name)) o.userData.wasVisible = true; });
    if (!on && heroInst) dressWeapons(heroInst);
    if (on) { toast('🔥 Es wird dunkel – du zündest eine Fackel an'); A.sfx('torch'); }
  }
  // Regenspritzer am Boden (Ringe, die aufblitzen)
  const SPLASH_N = 160; const splashGeo = new THREE.RingGeometry(.08, .16, 10); splashGeo.rotateX(-Math.PI / 2);
  const splash = new THREE.InstancedMesh(splashGeo, new THREE.MeshBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: .55, depthWrite: false }), SPLASH_N); splash.frustumCulled = false; splash.visible = false; scene.add(splash);
  const splashPh = Array.from({ length: SPLASH_N }, () => Math.random()), splashPos = Array.from({ length: SPLASH_N }, () => [0, 0]);
  const splashD = new THREE.Object3D();
  function updateSplashes(dt, strength) {
    const px = player.position.x, pz = player.position.z;
    for (let i = 0; i < SPLASH_N; i++) { splashPh[i] += dt * 2.2; if (splashPh[i] > 1) { splashPh[i] = 0; splashPos[i] = [px + rng(-14, 14), pz + rng(-14, 14)]; } const [x, z] = splashPos[i]; const s = .2 + splashPh[i] * .9; splashD.position.set(x, groundY(x, z) + .03, z); splashD.scale.set(s, 1, s); splashD.updateMatrix(); splash.setMatrixAt(i, splashD.matrix); }
    splash.instanceMatrix.needsUpdate = true; splash.material.opacity = .28 * strength;
  }
  function strike() {
    const px = player.position.x, pz = player.position.z, a = Math.random() * 6.3, d = rng(25, 80); const bx = px + Math.cos(a) * d, bz = pz + Math.sin(a) * d; const p = boltGeo.attributes.position; let x = bx, z = bz;
    for (let i = 0; i < 40; i++) { const y = 70 - i * (70 - groundY(bx, bz)) / 39; p.setXYZ(i, x, y, z); x += rng(-2.2, 2.2); z += rng(-2.2, 2.2); } p.needsUpdate = true;
    const bp = branchGeo.attributes.position; for (let b = 0; b < 4; b++) { const i0 = 6 + b * 8; let bx2 = p.getX(i0), by = p.getY(i0), bz2 = p.getZ(i0); const dx = rng(-1, 1), dz = rng(-1, 1); for (let k = 0; k < 6; k++) { bp.setXYZ(b * 6 + k, bx2, by, bz2); bx2 += dx * 1.6 + rng(-.8, .8); by -= rng(1, 3); bz2 += dz * 1.6 + rng(-.8, .8); } } bp.needsUpdate = true; boltMat.opacity = 1; weather.flash = 1.4; weather.lightning = .25; toast('⚡ Blitz!'); A.sfx('thunder', { delay: .3 + Math.random() * .9 });
  }
  let wind = 0;
  function setWeather(kind, announce) {
    weather.kind = kind; weather.t = 0; weather.next = kind === 'clear' ? rng(180, 320) : kind === 'cloudy' ? rng(90, 160) : rng(80, 150);
    if (announce) toast({ clear: '☀️ Es klart auf', cloudy: '☁️ Wolken ziehen auf', rain: '🌧️ Regen zieht auf', storm: '⛈️ Sturm! Blitze und Wind', snow: '❄️ Es beginnt zu schneien' }[kind]);
  }
  function updateWeather(dt) {
    weather.t += dt; if (weather.t > weather.next) { const i = WEATHERS.indexOf(weather.kind); setWeather(WEATHERS[(i + 1) % WEATHERS.length], true); }
    const k = weather.kind, w = WX[k], lerpK = Math.min(1, dt * .25), wx = gfx.wx;
    wx.cloud += (w.cloud - wx.cloud) * lerpK; wx.cloudDark += (w.dark - wx.cloudDark) * lerpK; wx.dim += (w.dim - wx.dim) * lerpK; wx.fogMul += (w.fog - wx.fogMul) * lerpK;
    wx.fogTint.lerp(k === 'snow' ? new THREE.Color(1.05, 1.08, 1.12) : new THREE.Color(1, 1, 1), lerpK);
    WORLD_U.wet.value += (w.wet - WORLD_U.wet.value) * Math.min(1, dt * (w.wet ? .2 : .03)); // trocknet langsam
    WORLD_U.snow.value += (w.snow - WORLD_U.snow.value) * Math.min(1, dt * (w.snow ? .05 : .015)); // Schneedecke wächst/schmilzt langsam
    const wantRain = (k === 'rain' ? .6 : k === 'storm' ? .9 : 0), wantSnow = (k === 'snow' ? .95 : 0);
    rainMat.opacity += (wantRain - rainMat.opacity) * Math.min(1, dt * .5); snowMat.opacity += (wantSnow - snowMat.opacity) * Math.min(1, dt * .5);
    rain.visible = rainMat.opacity > .02 && settings.quality >= 1; snow.visible = snowMat.opacity > .02 && settings.quality >= 1;
    wind += ((w.wind * (1 + Math.sin(clock.t * .7) * .4 + Math.sin(clock.t * 2.3) * .15)) - wind) * Math.min(1, dt * .5);
    const px = player.position.x, pz = player.position.z;
    if (rain.visible) { const p = dropGeo.attributes.position; const sp = k === 'storm' ? 38 : 24; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * sp, x = p.getX(i) + dt * wind * 10; if (y < -2 || Math.abs(x) > 40) { x = rng(-40, 40); y = 30; } p.setXYZ(i, x, y, p.getZ(i)); } p.needsUpdate = true; rain.position.set(px, groundY(px, pz), pz); rainMat.size = k === 'storm' ? 1.7 : 1.3; }
    if (snow.visible) { const p = flakeGeo.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * (1.6 + (i % 4) * .3), x = p.getX(i) + Math.sin(clock.t * 1.3 + i) * dt * 1.2 + dt * wind * 2.5; if (y < -1 || Math.abs(x) > 40) { x = rng(-40, 40); y = 28; } p.setXYZ(i, x, y, p.getZ(i)); } p.needsUpdate = true; snow.position.set(px, groundY(px, pz), pz); }
    if (k === 'storm' && weather.lightning <= 0 && wx.cloudDark > .8 && Math.random() < dt * .2) strike();
    if (weather.lightning > 0) weather.lightning -= dt; weather.flash = Math.max(0, weather.flash - dt * 6); boltMat.opacity = Math.max(0, boltMat.opacity - dt * 5);
    gfx.flash(weather.flash * .9);
    grassMat.userData.wind = wind; WORLD_U.wind.value = wind;
    splash.visible = rain.visible && settings.quality >= 2 && rainMat.opacity > .1; if (splash.visible) updateSplashes(dt, rainMat.opacity);
  }
  window.__weather = setWeather;
  // ---------- Steuerung ----------
  const keys = {}; const hud = $('hud');
  let uiOpen = () => !$('inventory').hidden || !$('settings').hidden || !$('npc').hidden || !$('station').hidden || !$('pause').hidden || !$('vocabScreen').hidden || !$('newWord').hidden || !$('season').hidden || $('dead').classList.contains('on') || battleOn;
  // Eingabe-Erkennung: Joystick nur bei Touch, sonst Tastatur/Controller
  let lastInput = ('ontouchstart' in window) ? 'touch' : 'key', padSeen = false;
  function setInput(k) { if (lastInput === k) return; lastInput = k; joy.style.display = k === 'touch' ? '' : 'none'; $('ctrlHint').textContent = k === 'pad' ? 'Controller: Stick laufen · A Rolle · B auf/absteigen · X benutzen · Y Inventar' : k === 'key' ? 'W/S laufen · A/D drehen · Leertaste Rolle · F auf/absteigen · E benutzen · I Inventar · Esc Pause' : 'Joystick laufen · Knöpfe rechts'; if (k === 'pad') toast('Controller erkannt'); if (k === 'key') toast('Tastatur erkannt · Joystick ausgeblendet'); }
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setInput('touch'); }, true);
  window.addEventListener('gamepadconnected', () => setInput('pad'));
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    keys[e.key.toLowerCase()] = true; if (hud.classList.contains('on')) setInput('key');
    if (!hud.classList.contains('on')) return;
    if (e.key === ' ') { e.preventDefault(); if (!uiOpen()) roll(); }
    if (e.key.toLowerCase() === 'f' && !uiOpen()) toggleMount();
    if (e.key.toLowerCase() === 'e' && !uiOpen()) interact();
    if (e.key.toLowerCase() === 'i') { if ($('inventory').hidden) openInv(); else $('inventory').hidden = true; }
    if (e.key.toLowerCase() === 'v' && !battleOn) { if ($('vocabScreen').hidden) openVocab(); else $('vocabScreen').hidden = true; }
    if (e.key === 'Escape') { if (!$('settings').hidden || !$('inventory').hidden || !$('npc').hidden || !$('vocabScreen').hidden || !$('season').hidden) { $('settings').hidden = true; $('inventory').hidden = true; $('npc').hidden = true; $('vocabScreen').hidden = true; $('season').hidden = true; } else $('pause').hidden = !$('pause').hidden; }
    if (/^[1-9]$/.test(e.key)) selectHot(+e.key - 1);
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  const joy = $('joy'); const knob = joy.querySelector('i'); let joyVec = { x: 0, y: 0 }, joyId = null;
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(joyId); moveJoy(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
  joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
  function moveJoy(e) { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joyVec = { x, y }; knob.style.transform = `translate(${x * r.width * .28}px, ${y * r.width * .28}px)`; }
  function endJoy() { joyId = null; joyVec = { x: 0, y: 0 }; knob.style.transform = ''; }
  // Controller
  function pollPad() { const pads = navigator.getGamepads ? navigator.getGamepads() : []; const p = pads && pads[0]; if (!p) return null; if (p.axes.some(v => Math.abs(v) > .3) || p.buttons.some(b => b.pressed)) setInput('pad'); const ax = Math.abs(p.axes[0]) > .15 ? p.axes[0] : 0, ay = Math.abs(p.axes[1]) > .15 ? p.axes[1] : 0; if (p.buttons[0] && p.buttons[0].pressed && !pollPad.a) roll(); pollPad.a = p.buttons[0] && p.buttons[0].pressed; if (p.buttons[2] && p.buttons[2].pressed && !pollPad.x) interact(); pollPad.x = p.buttons[2] && p.buttons[2].pressed; if (p.buttons[3] && p.buttons[3].pressed && !pollPad.y) { if ($('inventory').hidden) openInv(); else $('inventory').hidden = true; } pollPad.y = p.buttons[3] && p.buttons[3].pressed; if (p.buttons[1] && p.buttons[1].pressed && !pollPad.b) toggleMount(); pollPad.b = p.buttons[1] && p.buttons[1].pressed; return { x: ax, y: ay, sprint: !!((p.buttons[10] && p.buttons[10].pressed) || (p.buttons[5] && p.buttons[5].pressed)) }; }

  let heading = Math.PI * .5, vy = 0, rolling = 0, t0 = performance.now(), walkPhase = 0, mountCalled = false, swimming = false;
  camera.position.set(14, 6, 0);
  // Maus / Finger-Wischen: Kamera um den Charakter drehen
  let camYaw = 0, camPitch = 0, dragId = null, dragX = 0, dragY = 0;
  renderer.domElement.addEventListener('pointerdown', e => { if (!hud.classList.contains('on') || uiOpen()) return; dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; });
  window.addEventListener('pointermove', e => { if (e.pointerId !== dragId) return; const dx = e.clientX - dragX, dy = e.clientY - dragY; dragX = e.clientX; dragY = e.clientY; camYaw -= dx * .006 * settings.sens * (settings.invert ? -1 : 1); camPitch = clamp(camPitch + dy * .004, -.35, .6); });
  window.addEventListener('pointerup', e => { if (e.pointerId === dragId) dragId = null; }); window.addEventListener('pointercancel', e => { if (e.pointerId === dragId) dragId = null; });
  function roll() { if (rolling <= 0 && !swimming) { rolling = .7; A.sfx('dodge'); if (heroInst) { heroInst.current = null; heroInst.play('Dodge_Forward', .05, false); } toast('Ausweichrolle!'); } }
  function toggleMount() { A.sfx('mount');
    if (state.mounted) { state.mounted = false; player.remove(mountMesh); mountFree.add(mountMesh); mountFree.position.copy(player.position); mountFree.rotation.y = heading; setWalking(); toast('Abgestiegen · F = wieder aufsteigen / rufen'); $('mountBtn').textContent = '🐾 Aufsteigen'; $('stamLabel').textContent = 'Ausdauer'; }
    else { const d = mountFree.position.distanceTo(player.position); if (d < 3.5) { state.mounted = true; mountFree.remove(mountMesh); player.add(mountMesh); setRiding(); toast('Aufgestiegen'); $('mountBtn').textContent = '🐾 Absteigen'; } else { mountCalled = true; toast('Reittier gerufen – es kommt angelaufen'); } }
  }
  const near = (obj, r) => player.position.distanceTo(obj.position) < r;
  function interact() {
    if (merchant.visible && near(merchant, 4)) { openShop(); return; }
    if (near(npc, 3.5)) { renderQuests(); $('npc').hidden = false; return; }
    for (const ch of chests) if (near(ch, 2.5)) { if (ch.userData.open) { toast('Schon geöffnet · Reset um Mitternacht'); return; } ch.userData.open = true; bumpStat('chests'); A.sfx('chest'); ch.userData.lid.rotation.x = -1.6; const loot = ch.userData.gold ? ['hammer', 'helmI', 'chestI', 'phoenix'][Math.floor(Math.random() * 4)] : ['heal', 'coin', 'stam', 'bootsI'][Math.floor(Math.random() * 4)]; if (loot === 'coin') { state.coins += 25; state.stats.coinsEarned += 25; popDmg(player, '+25 🪙', 'coin'); toast('Truhe · +25 🪙'); } else { addItem(loot); toast((ch.userData.gold ? 'Goldene Truhe · ' : 'Truhe · ') + ITEMS[loot].name); } if (ch === chests[0]) progress('chest'); gainXp(15); return; }
    for (const s of stations) if (near(s.g, 2.5)) { if (s.done) { toast('Station erledigt · kommt morgen wieder'); return; } openStation(s); return; }
    for (const w of wolves) if (w.userData.alive && near(w, 3.5)) { startBattle(w.userData.kind, w); return; }
    if (gateDist() < 4.5 && !gate.userData.open) { tryGate(); return; }
    if (near(troll, 8)) { if (!gate.userData.open) { toast('Erst das Tor öffnen (ab Level 10)'); return; } startBattle('troll'); return; }
    toast('Nichts in der Nähe · E bei NPC, Truhe, Station, Gegner');
  }
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); gfx.setSize(); }
  window.addEventListener('resize', resize); resize();
  function animateLegs(m, speed) { const u = m.userData; if (!u || !u.legs) return; const gallop = u.landSpeed >= 9 && !swimming; u.legs.forEach((l, i) => { const ph = gallop ? walkPhase + (i > 1 ? Math.PI * .75 : 0) + (i % 2 ? .3 : 0) : walkPhase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * .5 : 0); const amp = gallop ? .95 : (swimming ? .8 : .6); l.hip.rotation.x = Math.sin(ph) * amp * speed; if (l.knee !== l.hip) l.knee.rotation.x = Math.max(0, -Math.sin(ph)) * (gallop ? 1.1 : .8) * speed; }); if (u.tail && u.tail.children.length) { let j = u.tail, k = 0; while (j.children[1]) { j = j.children[1]; j.rotation.y = Math.sin(clock.t * 3 + k * .7) * .25; k++; } } }

  // Wippen des Reittiers und Mitbewegung des Reiters
  function rideBob(sp, rider) {
    const u = mountMesh.userData; const gallop = u.landSpeed >= 9;
    const bob = sp > 0 ? Math.abs(Math.sin(walkPhase * (gallop ? 1 : 2))) * (gallop ? .17 : .07) * sp : Math.sin(clock.t * 1.6) * .015;
    mountMesh.position.y = bob; mountMesh.rotation.x = sp > 0 ? Math.sin(walkPhase) * (gallop ? .07 : .03) * sp : 0;
    if (rider && heroInst) { heroInst.obj.position.y = (u.heroY !== undefined ? u.heroY : u.seatY - .5) + bob * .7; heroInst.obj.rotation.x = -.15 * sp; }
  }
  let camShake = 0, heroLockUntil = 0, sprinting = false;
  let bannerT = null; function banner(title, sub, cls) { const b = $('banner'); b.className = 'banner show ' + (cls || ''); b.innerHTML = '<div class="bt">' + title + '</div>' + (sub ? '<div class="bs">' + sub + '</div>' : ''); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 2600); }
  // Schwebende Schadenszahl über einem Objekt
  function popDmg(obj, text, cls) {
    const el = document.createElement('div'); el.className = 'dmg ' + (cls || ''); el.textContent = text; $('labels').appendChild(el);
    const v = obj.position.clone(); v.y += 2.3; v.project(camera); el.style.left = ((v.x * .5 + .5) * stage.clientWidth) + 'px'; el.style.top = ((-v.y * .5 + .5) * stage.clientHeight) + 'px';
    setTimeout(() => el.remove(), 1100);
  }
  function heroAttackAnim() {
    if (!heroInst) return; const w = equip.weapon; const names = w === 'bow' ? ['1H_Ranged_Shoot', '2H_Ranged_Shoot', 'Slice'] : w === 'hammer' ? ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', 'Chop'] : ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', 'Slice'];
    A.sfx('swing'); for (const n of names) if (heroInst.play(n, .08, false)) break; heroLockUntil = performance.now() + 700; setTimeout(() => { if (heroInst && performance.now() >= heroLockUntil) heroInst.play('Idle', .2); }, 720);
  }
  function heroHitAnim() { if (!heroInst) return; if (heroInst.play('Hit_A', .05, false) || heroInst.play('Hit', .05, false)) { heroLockUntil = performance.now() + 500; setTimeout(() => heroInst && heroInst.play('Idle', .2), 520); } }
  function foeAnim(name, ms) { if (!foeObj || !foeObj.userData.inst) return; const inst = foeObj.userData.inst; if (inst.play(name, .08, false)) { foeObj.userData.animLock = performance.now() + ms; setTimeout(() => { if (foeObj && performance.now() >= foeObj.userData.animLock) inst.play('Idle', .2); }, ms + 20); } }
  let lastWolfToast = 0, frames = 0, fpsT = 0, lastFrame = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (settings.fps && now - lastFrame < 1000 / settings.fps - 1) return; lastFrame = now;
    const dt = Math.min(.05, (now - t0) / 1000); t0 = now; clock.t += dt;
    anims.forEach(a => a.update(dt));
    if (window.__adapt) window.__adapt(now);
    frames++; if (now - fpsT > 500) { window.__fpsNow = Math.round(frames * 1000 / (now - fpsT)); if (settings.showFps) $('fpsBox').textContent = window.__fpsNow + ' FPS'; frames = 0; fpsT = now; }
    if (grassMat.userData.u) grassMat.userData.u.value = clock.t;
    updateWeather(dt); if (grassMat.userData.w) grassMat.userData.w.value = grassMat.userData.wind || 0;
    const inWorld = hud.classList.contains('on') && !uiOpen();
    const pad = inWorld ? pollPad() : null;
    let fwd = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0) - joyVec.y - (pad ? pad.y : 0);
    let turn = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0) - joyVec.x - (pad ? pad.x : 0);
    fwd = clamp(fwd, -1, 1); turn = clamp(turn, -1, 1) * (settings.invert ? -1 : 1);
    const px = player.position.x, pz = player.position.z;
    swimming = inWater(px, pz) && !onBridge(px, pz);
    const moving = inWorld && Math.abs(fwd) > .05;
    if (inWorld) {
      heading += turn * 2.4 * settings.sens * dt * (fwd < 0 ? -1 : 1);
      sprinting = !state.mounted && !swimming && moving && (keys['shift'] || (pad && pad.sprint)) && state.stamina > 1;
      let base = state.mounted ? (swimming ? mountMesh.userData.waterSpeed : mountMesh.userData.landSpeed) : (swimming ? 3.2 : sprinting ? 8.2 : 5.5);
      if (sprinting) state.stamina = Math.max(0, state.stamina - dt * 9);
      if (state.stamina <= 0 && state.mounted) base *= .4;
      const sp = (rolling > 0 ? base * 2 : base) * dt * (fwd < 0 ? .6 : 1);
      if (moving || rolling > 0) {
        const f = rolling > 0 ? 1 : fwd;
        player.position.x = clamp(player.position.x + Math.sin(heading) * sp * f, -HALF, HALF); player.position.z = clamp(player.position.z + Math.cos(heading) * sp * f, -HALF, HALF);
        if (state.mounted) { state.stamina = Math.max(0, state.stamina - dt * 2.5); if (state.stamina === 0) toast('Ausdauer leer · 10 Vokabeln füllen auf (Trank in Hotbar 4)'); }
        walkPhase += dt * (state.mounted ? 9 : 11) * Math.abs(f);
      } else state.stamina = Math.min(100, state.stamina + dt * 5);
      if (!state.mounted && moving) state.stamina = Math.min(100, state.stamina + dt * 3);
      $('stam').style.width = state.stamina + '%'; $('stamNum').textContent = Math.round(state.stamina) + '%';
      player.rotation.y = heading; caveCollision();
      if (Math.hypot(px - grassCenter.x, pz - grassCenter.z) > GR * .55) placeGrass(px, pz);
    }
    if (rolling > 0) rolling -= dt;
    // Animationen der GLTF-Figuren
    if (heroInst && performance.now() > heroLockUntil) {
      if (state.mounted) heroInst.play(swimming ? 'Sit_Floor_Idle' : 'Sit_Chair_Idle');
      else if (rolling > 0) { if (!state.mounted) heroInst.play('Dodge_Forward', .05, false); }
      else if (swimming) { heroInst.play(moving ? 'Walking_A' : 'Lie_Idle'); heroInst.obj.rotation.x = 1.2; heroInst.obj.position.y = .3; }
      else { heroInst.obj.rotation.x = 0; heroInst.obj.position.y = 0; const slow = Math.abs(fwd) < .5; heroInst.play(moving ? (fwd < 0 ? 'Walking_Backwards' : slow ? 'Walking_A' : 'Running_A') : (Math.abs(turn) > .3 ? 'Walking_A' : 'Idle'), .15); if (heroInst.action) heroInst.action.timeScale = moving ? (slow ? clamp(Math.abs(fwd) * 2, .6, 1.1) : clamp(Math.abs(fwd), .85, 1.15) * (sprinting ? 1.35 : 1)) : (Math.abs(turn) > .3 ? .8 : 1); }
    }
    if (mountMesh.userData.inst) { const a = mountMesh.userData.inst.action; if (a) { a.paused = !(moving || swimming); a.timeScale = swimming ? .5 : clamp(.5 + Math.abs(fwd) * .8, .6, 1.3); } }
    const gy = groundY(player.position.x, player.position.z);
    const targetY = swimming ? WATER_Y - (state.mounted ? .75 : .95) + Math.sin(clock.t * 2) * .06 : (onBridge(player.position.x, player.position.z) ? 1.75 : gy) + (rolling > 0 ? Math.sin(rolling / .7 * Math.PI) * .7 : 0);
    // Fallphysik: in der Luft fallen, harte Landung kostet HP
    if (!swimming && player.position.y > targetY + .7) { vy -= 24 * dt; player.position.y += vy * dt; if (player.position.y <= targetY) { if (vy < -12) damage(Math.min(60, Math.round((-vy - 12) * 5)), 'Sturz aus ' + Math.round((vy * vy) / 48) + ' m Höhe'); player.position.y = targetY; vy = 0; } }
    else { vy = 0; player.position.y += (targetY - player.position.y) * Math.min(1, dt * 10); }
    if (swimming) { state.air = Math.max(0, state.air - dt * 0); if (inWorld && !animateLegs.swimToast) { toast(state.mounted && prefs.tier === 'tiger' ? 'Schwimmen · Tiger ist im Wasser langsam' : 'Schwimmen'); animateLegs.swimToast = true; } } else animateLegs.swimToast = false;
    if (state.mounted) { animateLegs(mountMesh, moving || swimming ? 1 : 0); rideBob(moving && !swimming ? Math.abs(fwd) : 0, true); mountMesh.userData.head.rotation.x = moving ? Math.sin(walkPhase * 2) * .06 : Math.sin(clock.t * 1.2) * .05; hero.position.y = mountMesh.userData.seatY + (moving ? Math.abs(Math.sin(walkPhase)) * .08 : Math.sin(clock.t * 1.5) * .02); }
    else if (swimming) {
      // Kraulen: Arme kreisen abwechselnd, Beine schlagen
      const sw = clock.t * (moving ? 7 : 3);
      hero.userData.arms.forEach((a, i) => { const ph = sw + (i ? Math.PI : 0); a.rotation.x = ph % (Math.PI * 2) - Math.PI; a.rotation.z = (i ? -1 : 1) * .35; if (a.userData.elbow) a.userData.elbow.rotation.x = -.5 - Math.max(0, Math.sin(ph)) * .6; });
      hero.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(sw * 1.6 + (i ? Math.PI : 0)) * .35; if (l.userData.knee) l.userData.knee.rotation.x = .2; });
      hero.rotation.x = 1.25 + Math.sin(clock.t * 2) * .05; hero.position.y = .25 + Math.sin(clock.t * 2.2) * .04;
    } else { hero.userData.legs.forEach((l, i) => { const ph = walkPhase + (i ? Math.PI : 0); l.rotation.x = moving ? Math.sin(ph) * .7 : 0; if (l.userData.knee) l.userData.knee.rotation.x = moving ? Math.max(0, -Math.sin(ph)) * .9 : 0; }); hero.userData.arms.forEach((a, i) => { a.rotation.x = moving ? Math.sin(walkPhase + (i ? 0 : Math.PI)) * .6 : Math.sin(clock.t * 1.5) * .04; a.rotation.z = 0; if (a.userData.elbow) a.userData.elbow.rotation.x = moving ? -.4 : -.15; }); hero.rotation.x = 0; hero.position.y = 0; }
    hero.userData.cape.rotation.x = .18 + (moving ? .5 : .05) + Math.sin(clock.t * 4) * .05;
    // Abgestelltes / gerufenes Reittier
    if (!state.mounted) { const d = mountFree.position.distanceTo(player.position); if (mountCalled && d > 2.5) { const dx = player.position.x - mountFree.position.x, dz = player.position.z - mountFree.position.z; const l = Math.hypot(dx, dz); mountFree.position.x += dx / l * dt * 11; mountFree.position.z += dz / l * dt * 11; mountFree.rotation.y = Math.atan2(dx, dz); walkPhase += dt * 9; animateLegs(mountMesh, 1); rideBob(1, false); } else if (mountCalled) { mountCalled = false; toggleMount(); } else { animateLegs(mountMesh, 0); rideBob(0, false); if (mountMesh.userData.head) mountMesh.userData.head.rotation.y = Math.sin(clock.t * .6) * .4; } mountFree.position.y = inWater(mountFree.position.x, mountFree.position.z) ? WATER_Y - .7 : groundY(mountFree.position.x, mountFree.position.z); }
    // Interaktions-Hinweis
    let hint = ''; if (inWorld) { state.stats.playSecs += dt; if (merchant.visible && near(merchant, 4)) hint = 'Beim Händler einkaufen'; else if (near(npc, 3.5)) hint = 'Mit Bram sprechen'; else if (chests.some(c => near(c, 2.5))) hint = 'Truhe öffnen'; else if (stations.some(s => near(s.g, 2.5))) hint = 'Vokabel-Station'; else if (wolves.some(w => w.userData.alive && near(w, 3.5))) hint = 'Angreifen'; else if (gateDist() < 4.5 && !gate.userData.open) hint = state.level >= 10 ? 'Tor öffnen' : 'Tor verschlossen · ab Level 10'; else if (near(troll, 8)) hint = 'Waldtroll herausfordern'; else if (!state.mounted && mountFree.position.distanceTo(player.position) < 3.5) hint = 'F · Aufsteigen'; }
    $('interactText').textContent = hint; $('interact').classList.toggle('show', !!hint);

    stations.forEach((s, i) => { s.c.rotation.y += dt; s.c.position.y = 1.4 + Math.sin(clock.t * 2.5 + i) * .15; s.ring.rotation.z += dt * .5; });
    flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(clock.t * 14 + i) * .18; f.rotation.y += dt * 2; }); if (gate.userData.flames) gate.userData.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(clock.t * 12 + i * 2) * .22; f.rotation.y += dt * 3; }); fire.intensity = 2.3 + Math.sin(clock.t * 9) * .5;
    const spPos = smoke.geometry.attributes.position; for (let i = 0; i < spPos.count; i++) { let y = spPos.getY(i) + dt * 1.2; if (y > 7) y = 2; spPos.setY(i, y); spPos.setX(i, 3 + Math.sin(clock.t * 2 + i) * .35 * (y - 2) * .3); } spPos.needsUpdate = true;
    if (gate.userData.open && gate.userData.lift < 6.6) { gate.userData.lift = Math.min(6.6, gate.userData.lift + dt * 1.6); gate.children.forEach(c => { if (c !== gate.userData.lock) c.position.y = (c.userData.y0 === undefined ? (c.userData.y0 = c.position.y) : c.userData.y0) + gate.userData.lift; }); gate.userData.lock.visible = false; }
    troll.userData.body.scale.y = 1.15 + Math.sin(clock.t * 1.7) * .03; troll.userData.head.rotation.y = Math.sin(clock.t * .7) * .35; troll.userData.arms[0].rotation.x = Math.sin(clock.t * 1.2) * .15;
    if (npc.userData.inst) { const ph = clock.t % 9; npc.userData.inst.play(near(npc, 4) ? 'Interact' : ph < 2 ? 'Cheer' : 'Idle', .3); }
    npc.userData.marker.position.y = 2.7 + Math.sin(clock.t * 3) * .12; npc.userData.marker.rotation.y += dt * 2; npc.userData.cape.rotation.x = .2 + Math.sin(clock.t * 2) * .05;
    wolves.forEach(w => { if (!w.userData.alive) return; if (battleOn && w === foeObj) { w.userData.dir = Math.atan2(player.position.x - w.position.x, player.position.z - w.position.z); w.rotation.y = w.userData.dir; if (w.userData.inst && !(w.userData.animLock > performance.now())) w.userData.inst.play('Idle', .2); return; } w.userData.t -= dt; const d = w.position.distanceTo(player.position); const safe = Math.hypot(player.position.x, player.position.z) < 22; const hunting = inWorld && !safe && d < 18 && d > 2.8; if (hunting) { w.userData.dir = Math.atan2(player.position.x - w.position.x, player.position.z - w.position.z); } else if (w.userData.t <= 0) { w.userData.t = rng(2, 5); w.userData.dir = Math.random() * 6.3; } w.rotation.y = w.userData.dir; if (d > 2.8) { const spd = hunting ? (w.userData.alpha ? 4.2 : w.userData.kind === 'imp' ? 4.6 : 3.4) : 1.6; const nx = w.position.x + Math.sin(w.userData.dir) * dt * spd, nz = w.position.z + Math.cos(w.userData.dir) * dt * spd; if (!inWater(nx, nz)) { w.position.x = clamp(nx, -HALF, HALF); w.position.z = clamp(nz, -HALF, HALF); } } w.position.y = groundY(w.position.x, w.position.z); w.userData.legs.forEach((l, i) => { l.hip.rotation.x = Math.sin(clock.t * 8 + i * 1.6) * .5; }); if (inWorld && d < 4 && now - lastWolfToast > 2500) { lastWolfToast = now; toast((w.userData.alpha ? 'Troll-Häuptling' : 'Troll-Krieger') + ' greift an! E = kämpfen, weglaufen = fliehen'); } w.userData.atk = (w.userData.atk || 0) - dt; if (w.userData.inst) { const hunt = d < 14 && d > 2.5 && inWorld; w.userData.inst.play(d < 3.2 && inWorld ? 'Punch' : hunt ? 'Run' : 'Walk', .15); if (w.userData.inst.action) w.userData.inst.action.timeScale = hunt ? (w.userData.alpha ? 1.05 : 1.15) : .9; } if (w.userData.arms) { const a = w.userData.arms[1]; a.rotation.x = d < 3.2 ? -1.6 + Math.sin(clock.t * 6) * .8 : Math.sin(clock.t * 2) * .1; w.userData.arms[0].rotation.x = Math.sin(clock.t * 2 + 1) * .1; } if (inWorld && !safe && d < 3.2 && w.userData.atk <= 0) { w.userData.atk = 1.0; const dm = w.userData.alpha ? 20 : w.userData.weapon === 'axe' ? 15 : w.userData.weapon === 'spear' ? 12 : 10; damage(dm, (w.userData.alpha ? 'Häuptlings-Axt' : { club: 'Keulenschlag', axe: 'Axthieb', spear: 'Speerstich' }[w.userData.weapon]) + '! −' + dm + ' HP'); } });
    if (water.material.userData.wt) water.material.userData.wt.value = clock.t;
    if (settings.quality >= 2) { for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), z = wp.getZ(i); wp.setY(i, Math.sin(x * .4 + clock.t * 1.4) * .06 + Math.cos(z * .3 + clock.t) * .05); } wp.needsUpdate = true; }
    const fpos = fireflies.geometry.attributes.position; if (settings.quality >= 2) for (let i = 0; i < fpos.count; i++) fpos.setY(i, 2.5 + Math.sin(clock.t * 1.4 + i * 1.7) * .8); fpos.needsUpdate = true; fireflies.material.opacity = (.5 + Math.sin(clock.t * 4) * .3) * Math.max(.08, WORLD_U.night.value);
    if (settings.quality >= 1) butterflies.forEach((b, i) => { const u = b.userData; const t = clock.t * .5 + u.ph; const x = player.position.x * .6 + u.ax + Math.sin(t) * 6, z = player.position.z * .6 + u.az + Math.cos(t * .8) * 6; b.position.set(x, groundY(x, z) + 1.4 + Math.sin(t * 3) * .4, z); b.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * .8)); const f = Math.sin(clock.t * 18 + i) * .9; u.wl.rotation.y = f; u.wr.rotation.y = -f; });
    const lpos = leaves.geometry.attributes.position; if (settings.quality >= 2) for (let i = 0; i < lpos.count; i++) { let y = lpos.getY(i) - dt * (.6 + (i % 5) * .2); let x = lpos.getX(i) + Math.sin(clock.t + i) * dt * .8, z = lpos.getZ(i); if (y < groundY(x, z) + .1 || Math.hypot(x - player.position.x, z - player.position.z) > 55) { x = player.position.x + rng(-50, 50); z = player.position.z + rng(-50, 50); y = groundY(x, z) + 6 + Math.random() * 8; } lpos.setXYZ(i, x, y, z); } lpos.needsUpdate = true;

    if (hud.classList.contains('on')) {
      if (moving && dragId === null) camYaw *= Math.pow(.15, dt);
      const cd = settings.camDist, cy = heading + camYaw, ch = cd * (.5 + camPitch);
      const camTarget = new THREE.Vector3(player.position.x - Math.sin(cy) * cd * Math.cos(camPitch), Math.max(player.position.y + ch, WATER_Y + 1.5), player.position.z - Math.cos(cy) * cd * Math.cos(camPitch));
      let lookX = player.position.x, lookY = player.position.y + 1.8, lookZ = player.position.z;
      if (battleOn && foeObj) { const fx = foeObj.position.x, fz = foeObj.position.z; const mx = (player.position.x + fx) / 2, mz = (player.position.z + fz) / 2; const dx = fx - player.position.x, dz = fz - player.position.z; const L = Math.hypot(dx, dz) || 1; const sx = -dz / L, sz = dx / L; const big = foeObj === troll; const dist = big ? Math.max(13, L * 1.2 + 6) : Math.max(6, L * 1.1 + 3); camTarget.set(mx + sx * dist - dx / L * 1.5, Math.max(player.position.y, foeObj.position.y) + (big ? 5.5 : 2.6), mz + sz * dist - dz / L * 1.5); lookX = mx; lookY = player.position.y + (big ? 3.2 : 1.4); lookZ = mz; }
      camera.position.lerp(camTarget, 1 - Math.pow(battleOn ? .01 : .002, dt)); camera.lookAt(lookX, lookY, lookZ);
      { const wantFov = sprinting ? 58 : (state.mounted && moving ? 56 : 50); if (Math.abs(camera.fov - wantFov) > .05) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); } }
      if (camShake > .004) { camera.position.x += (Math.random() - .5) * camShake; camera.position.y += (Math.random() - .5) * camShake * .7; camShake *= Math.pow(.01, dt); }
      drawMinimap(); if (frames % 2 === 0) updateLabels();
    } else { const a = now / 16000; camera.position.lerp(new THREE.Vector3(Math.cos(a) * 15, 6.5 + Math.sin(a * 2) * 1.2, Math.sin(a) * 15), 1 - Math.pow(.02, dt)); camera.lookAt(1, 3, -1); }
    A.tick(dt, { moving: inWorld && moving, mounted: state.mounted, swimming, night: WORLD_U.night.value, rain: rainMat.opacity, wind: WORLD_U.wind.value, battle: battleOn });
    gfx.updateSky(dt, player.position); if (weather.lightning > 0) { sun.intensity += 3.5; hemi.intensity += 1.2; }
    setTorch(hud.classList.contains('on') && gfx.sunElevation() < .04 && !swimming && !!heroInst);
    if (torch.visible) { const f = torch.userData.flame; f.scale.set(.75 + Math.sin(clock.t * 17) * .1, 1.2 + Math.sin(clock.t * 23) * .18, 1); torch.userData.light.intensity = 5.2 + Math.sin(clock.t * 19) * .8 + Math.sin(clock.t * 7) * .5; }
    { const want = settings.quality >= 2 ? (.07 + WORLD_U.night.value * .12 + gfx.wx.cloudDark * .1 + WORLD_U.wet.value * .08) : 0; mist.mat.opacity += (want - mist.mat.opacity) * Math.min(1, dt); mist.forEach(s => { if (!settings.quality) { s.visible = false; return; } s.visible = true; s.userData.ox += dt * s.userData.v; if (s.userData.ox > 50) s.userData.ox = -50; const x = player.position.x + s.userData.ox, z = player.position.z + s.userData.oz; s.position.set(x, groundY(x, z) + 1.2, z); }); }
    { wisp.visible = hud.classList.contains('on'); const u = wisp.userData; let near1 = null, nd = 36; for (const ch of chests) { if (ch.userData.open) continue; const d = ch.position.distanceTo(player.position); if (d < nd && d > 4) { nd = d; near1 = ch; } } u.tgtChest = near1;
      const a = heading + 2.4; let tx = player.position.x - Math.sin(a) * 1.6, tz = player.position.z - Math.cos(a) * 1.6; if (near1) { const dx = near1.position.x - player.position.x, dz = near1.position.z - player.position.z, l = Math.hypot(dx, dz); tx = player.position.x + dx / l * 3.2; tz = player.position.z + dz / l * 3.2; }
      const ty = Math.max(groundY(tx, tz), player.position.y) + 2.2 + Math.sin(clock.t * 2.1) * .25; wisp.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * (near1 ? 2.2 : 3.5))); const pulse = .8 + Math.sin(clock.t * 4) * .15 + (near1 ? .4 : 0); u.sp.scale.set(pulse, pulse, 1); u.l.intensity = (near1 ? 2.2 : 1.2) + Math.sin(clock.t * 6) * .3; u.l.color.setHex(near1 ? 0xffe28a : 0x8fd8ff);
      if (inWorld) { u.coinT -= dt; if (u.coinT <= 0) { u.coinT = 120 + Math.random() * 120; const n = 3 + Math.floor(Math.random() * 6); state.coins += n; state.stats.coinsEarned += n; popDmg(player, '+' + n + ' 🪙', 'coin'); toast('✨ Lumi hat ' + n + ' Münzen gefunden'); A.sfx('coin'); renderAll(); } } }
    pollen.visible = settings.quality >= 2 && WORLD_U.night.value < .5 && gfx.wx.cloudDark < .4; if (pollen.visible) { const pa = pollenGeo.attributes.position; for (let i = 0; i < pa.count; i++) { let x = pa.getX(i) + Math.sin(clock.t * .5 + i) * dt * .4 + dt * WORLD_U.wind.value * 1.5, y = pa.getY(i) + Math.cos(clock.t * .7 + i * 1.3) * dt * .25, z = pa.getZ(i) + Math.cos(clock.t * .4 + i) * dt * .3; if (Math.abs(x) > 30) x = -x * .95; if (y < .3) y = 6; if (y > 8) y = .5; pa.setXYZ(i, x, y, z); } pa.needsUpdate = true; pollen.position.set(player.position.x, groundY(player.position.x, player.position.z), player.position.z); pollen.material.opacity = .35 + Math.sin(clock.t * 2) * .1; }
    gfx.render(dt); renderInv();
  }
  function hideLoading() { const ld = $('loading'); if (ld) { ld.classList.add('off'); setTimeout(() => ld.remove(), 600); } }
  requestAnimationFrame(loop);

  // Weltkarte: Gelände wird einmal gerastert (Höhe → Farbe), Orte als Symbole
  let worldMapBase = null;
  function buildWorldMapBase() {
    const S = 800, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); const img = c.createImageData(S, S); const d = img.data;
    const H = new Float32Array(S * S); for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) H[py * S + px] = groundY((px / S - .5) * WORLD, (py / S - .5) * WORLD);
    const HS = new Float32Array(S * S); { const R = 12; const tmp = new Float32Array(S * S); for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const q = px + k; if (q >= 0 && q < S) { s += H[py * S + q]; n++; } } tmp[py * S + px] = s / n; } for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const q = py + k; if (q >= 0 && q < S) { s += tmp[q * S + px]; n++; } } HS[py * S + px] = s / n; } }
    const mix = (a, b, t) => a + (b - a) * t; const step = WORLD / S;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const y = H[py * S + px]; const i = (py * S + px) * 4;
      // Schummerung (Licht aus Nordwest)
      const yl = HS[py * S + Math.max(0, px - 2)], yr = HS[py * S + Math.min(S - 1, px + 2)], yu = HS[Math.max(0, py - 2) * S + px], yd = HS[Math.min(S - 1, py + 2) * S + px];
      const nx = (yl - yr) / (4 * step), nz = (yu - yd) / (4 * step); const len = Math.hypot(nx, nz, 1); const shade = clamp(.82 + (nx * -.6 + nz * -.6 + 1 * .5) / len * .45, .62, 1.2);
      let r, g, bb;
      if (y < WATER_Y - .3) { const dpt = clamp((WATER_Y - y) / 5, 0, 1); r = mix(150, 70, dpt); g = mix(205, 150, dpt); bb = mix(228, 205, dpt); }
      else if (y < WATER_Y + .6) { r = 214; g = 206; bb = 176; }
      else if (y > 21) { const t = clamp((y - 21) / 6, 0, 1); r = mix(205, 243, t); g = mix(200, 243, t); bb = mix(190, 240, t); }
      else if (y > 9) { const t = clamp((y - 9) / 12, 0, 1); r = mix(176, 205, t); g = mix(190, 200, t); bb = mix(140, 190, t); }
      else { const t = clamp(y / 9, 0, 1); r = mix(140, 176, t); g = mix(190, 190, t); bb = mix(118, 140, t); }
      const land = y >= WATER_Y - .3; const sh = land ? shade : 1;
      // Höhenlinien alle 4 m (dezent)
      const cl = land && y < 20 && Math.hypot(nx, nz) < .5 && (Math.abs(((y + 100) % 4)) < .16) ? .88 : 1;
      d[i] = r * sh * cl; d[i + 1] = g * sh * cl; d[i + 2] = bb * sh * cl; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // Wald als feine Punkte
    c.fillStyle = 'rgba(52,110,60,.55)'; treeSpots.forEach(([x, z]) => { const px = (x / WORLD + .5) * S, pz = (z / WORLD + .5) * S; c.beginPath(); c.arc(px, pz, 1.6, 0, 7); c.fill(); });
    // Uferlinie
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.arc((LAKE.x / WORLD + .5) * S, (LAKE.z / WORLD + .5) * S, LAKE.r * .93 * S / WORLD, 0, 7); c.stroke();
    // Vignette
    const vg = c.createRadialGradient(S / 2, S / 2, S * .35, S / 2, S / 2, S * .72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,16,24,.55)'); c.fillStyle = vg; c.fillRect(0, 0, S, S);
    return cv;
  }
  function drawWorldMap() {
    if (!worldMapBase) worldMapBase = buildWorldMapBase();
    const cv = $('worldmap'), c = cv.getContext('2d'), S = cv.width; c.drawImage(worldMapBase, 0, 0, S, S);
    const P = (x, z) => [(x / WORLD + .5) * S, (z / WORLD + .5) * S];
    const pin = (x, z, emoji, col, r) => { const [a, b] = P(x, z); c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6; c.shadowOffsetY = 2; c.fillStyle = '#fff'; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); c.restore(); c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath(); c.arc(a, b, r, 0, 7); c.stroke(); c.font = Math.round(r * 1.25) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(emoji, a, b + 1); };
    const dot = (x, z, col, r) => { const [a, b] = P(x, z); c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.2; c.stroke(); };
    const label = (x, z, t, dy, size) => { const [a, b] = P(x, z); c.font = '600 ' + (size || 13) + 'px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(10,16,24,.75)'; c.lineJoin = 'round'; c.strokeText(t, a, b + dy); c.fillStyle = '#fff'; c.fillText(t, a, b + dy); };
    const region = (x, z, t) => { const [a, b] = P(x, z); c.font = '700 15px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = '3px'; c.lineWidth = 5; c.strokeStyle = 'rgba(10,16,24,.6)'; c.strokeText(t.toUpperCase(), a, b); c.fillStyle = 'rgba(255,255,255,.92)'; c.fillText(t.toUpperCase(), a, b); c.letterSpacing = '0px'; };
    region(130, -95, 'Nordgipfel'); region(70, 175, 'Hochland'); region(-150, 70, 'Westkamm'); region(LAKE.x, LAKE.z, 'Großer See'); region(-60, -180, 'Dunkelwald');
    HUTS.forEach(([x, z]) => pin(x, z, '🏠', '#e0932f', 9)); RUINS.forEach(([x, z]) => pin(x, z, '🏛️', '#9aa3ad', 9));
    chests.forEach(ch => { if (!ch.userData.open) dot(ch.position.x, ch.position.z, ch.userData.gold ? '#ffd166' : '#e6a23c', 3.5); });
    stations.forEach(st => dot(st.g.position.x, st.g.position.z, st.done ? '#7fa58a' : '#35d6a0', 3.5));
    wolves.forEach(w => { if (w.userData.alive) dot(w.position.x, w.position.z, w.userData.alpha ? '#ff2a3c' : '#ff6b6b', w.userData.alpha ? 4 : 2.8); });
    pin(CAVE.x, CAVE.z, '💀', '#ff4d6d', 13); label(CAVE.x, CAVE.z, (gate.userData.open ? '' : '🔒 ') + 'Waldtroll · Lvl 10', 24, 12);
    pin(0, 0, '🏕️', '#7cff9b', 12); label(0, 0, 'Lager', 22, 12);
    const [px, pz] = P(player.position.x, player.position.z); c.save(); c.translate(px, pz); c.rotate(-heading + Math.PI); const cone = c.createRadialGradient(0, 0, 2, 0, 0, 26); cone.addColorStop(0, 'rgba(90,160,255,.55)'); cone.addColorStop(1, 'rgba(90,160,255,0)'); c.fillStyle = cone; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 26, -Math.PI / 2 - .55, -Math.PI / 2 + .55); c.closePath(); c.fill(); c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px, pz, 8, 0, 7); c.fill(); c.fillStyle = '#4a9bff'; c.beginPath(); c.arc(px, pz, 5.5, 0, 7); c.fill();
  }
  // Minimap (Nord oben, Radius 90 m)
  const mm = $('minimap'), mctx = mm.getContext('2d'); let mmFrame = 0;
  function drawMinimap() {
    if (mmFrame++ % 3) return; const R = 90, S = mm.width, c = S / 2, k = c / R; const px = player.position.x, pz = player.position.z;
    mctx.clearRect(0, 0, S, S); mctx.save(); mctx.beginPath(); mctx.arc(c, c, c - 2, 0, 7); mctx.clip();
    mctx.fillStyle = '#1f4a2a'; mctx.fillRect(0, 0, S, S);
    const P = (x, z) => [c + (x - px) * k, c + (z - pz) * k];
    mctx.fillStyle = '#2a7fb8'; let [lx, lz] = P(LAKE.x, LAKE.z); mctx.beginPath(); mctx.arc(lx, lz, LAKE.r * k * .92, 0, 7); mctx.fill();
    mctx.fillRect(P(RIVER_X - 4, 0)[0], 0, 8 * k, S);
    mctx.fillStyle = '#163a1f'; treeSpots.forEach(([x, z]) => { if (Math.abs(x - px) < R && Math.abs(z - pz) < R) { const [a, b] = P(x, z); mctx.fillRect(a - 1, b - 1, 2, 2); } });
    chests.forEach(ch => { const [a, b] = P(ch.position.x, ch.position.z); mctx.fillStyle = ch.userData.open ? '#777' : ch.userData.gold ? '#ffd166' : '#e6a23c'; mctx.fillRect(a - 2.5, b - 2.5, 5, 5); });
    stations.forEach(s => { const [a, b] = P(s.g.position.x, s.g.position.z); mctx.fillStyle = s.done ? '#4a7' : '#7cff9b'; mctx.beginPath(); mctx.arc(a, b, 2.5, 0, 7); mctx.fill(); });
    wolves.forEach(w => { if (!w.userData.alive) return; const [a, b] = P(w.position.x, w.position.z); mctx.fillStyle = w.userData.alpha ? '#ff2a3c' : '#ff6b6b'; mctx.beginPath(); mctx.arc(a, b, w.userData.alpha ? 3.5 : 2.5, 0, 7); mctx.fill(); });
    let [nx, nz] = P(npc.position.x, npc.position.z); mctx.fillStyle = '#ffd166'; mctx.font = '10px sans-serif'; mctx.fillText('!', nx - 2, nz + 4);
    let [cx2, cz2] = P(CAVE.x, CAVE.z); mctx.fillStyle = '#4a4e4a'; mctx.beginPath(); mctx.arc(cx2, cz2, CAVE.r * k, 0, 7); mctx.fill();
    let [tx, tz] = P(troll.position.x, troll.position.z); mctx.fillStyle = '#ff8a5c'; mctx.beginPath(); mctx.arc(tx, tz, 4, 0, 7); mctx.fill(); mctx.fillStyle = '#ffd166'; mctx.font = '9px sans-serif'; mctx.fillText(gate.userData.open ? '' : '🔒', P(gate.position.x, gate.position.z)[0] - 5, P(gate.position.x, gate.position.z)[1] + 3);
    mctx.translate(c, c); mctx.rotate(-heading + Math.PI); mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 5); mctx.lineTo(0, 2); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill(); mctx.restore();
    mctx.strokeStyle = 'rgba(124,255,155,.5)'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(c, c, c - 2, 0, 7); mctx.stroke(); mctx.fillStyle = '#9fb3a6'; mctx.font = 'bold 10px sans-serif'; mctx.fillText('N', c - 3, 11);
  }
  // Schwebende Namen + Lebensbalken über Gegnern
  const labels = $('labels'); const v3 = new THREE.Vector3();
  function updateLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const show = (obj, name, hp, max, cls) => { let el = obj.userData.label; if (!el) { el = document.createElement('div'); el.className = 'lbl ' + (cls || ''); el.innerHTML = `<div class="n"></div><div class="b"><i></i></div>`; labels.appendChild(el); obj.userData.label = el; } v3.set(obj.position.x, obj.position.y + (obj === troll ? 9.5 : obj.userData.alpha ? 4.8 : 3.5), obj.position.z).project(camera); const vis = v3.z < 1 && obj.visible && obj.position.distanceTo(player.position) < 32; el.style.display = vis ? 'block' : 'none'; if (vis) { el.style.left = ((v3.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - v3.y) / 2 * h) + 'px'; el.querySelector('.n').textContent = name; el.querySelector('i').style.width = (hp / max * 100) + '%'; } };
    wolves.forEach(x => show(x, x.userData.alpha ? 'Troll-Häuptling · Lvl 5' : x.userData.kind === 'imp' ? 'Schattenwicht · Lvl 3' : 'Troll-Krieger · Lvl 2', x.userData.hp, x.userData.maxHp, x.userData.alpha ? 'boss' : ''));
    show(troll, 'Waldtroll · Boss · Lvl 10', troll.userData.hp === undefined ? 220 : troll.userData.hp, 220, 'boss');
    const nl = npc.userData.label || (npc.userData.label = (() => { const el = document.createElement('div'); el.className = 'lbl npc'; el.innerHTML = '<div class="n">Bram · Quests</div>'; labels.appendChild(el); return el; })()); v3.set(npc.position.x, npc.position.y + 3.2, npc.position.z).project(camera); const nv = v3.z < 1 && npc.position.distanceTo(player.position) < 25; nl.style.display = nv ? 'block' : 'none'; if (nv) { nl.style.left = ((v3.x + 1) / 2 * w) + 'px'; nl.style.top = ((1 - v3.y) / 2 * h) + 'px'; }
  }

  // ---------- UI / Screens ----------
  let toastT; function toast(msg) { const t = $('toast'); if (t.textContent === msg && t.classList.contains('show')) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
  const screens = ['start', 'create', 'battle', 'map', 'win'];
  function show(name) { screens.forEach(s => { $(s).hidden = s !== name; }); hud.classList.toggle('on', name === 'world' || name === 'map' || name === 'battle' || name === 'win'); if (name === 'map') { drawWorldMap(); const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); $('merchant').textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'; } }
  $('newGame').onclick = () => show('create'); $('backStart').onclick = () => show('start');
  $('startWorld').onclick = () => { const free = listSaves().findIndex(d => !d); curSlot = free < 0 ? 1 : free + 1; state.name = $('pname').value.trim() || CHARS[state.charIdx].name; $('pnameHud').textContent = state.name; rebuildHero(); setMount(prefs.tier); toast('Willkommen im Lager, ' + state.name + '! Level 1 · Sprich mit Bram (E)'); renderAll(); updateTracker(); show('world'); saveGame(); };

  // ---------- Speichern / Laden ----------
  function saveGame() {
    const d = { name: state.name, charIdx: state.charIdx, prefs: { ...prefs }, state: { level: state.level, xp: state.xp, xpNeed: state.xpNeed, hp: state.hp, maxHp: state.maxHp, coins: state.coins, stamina: state.stamina, mounted: state.mounted, hot: state.hot, season: state.season, login: state.login, gems: state.gems, stats: state.stats, daily: state.daily, buffs: state.buffs }, pos: [player.position.x, player.position.y, player.position.z], heading, hotbar: [...hotbar], bags: { weapon: [...bags.weapon], armor: [...bags.armor], use: [...bags.use], misc: [...bags.misc] }, equip: { ...equip }, counts: Object.fromEntries(Object.entries(ITEMS).filter(([, it]) => it.n !== undefined).map(([k, it]) => [k, it.n])), quests: JSON.parse(JSON.stringify(qstate)), tracked, chests: chests.map(c => !!c.userData.open), stations: stations.map(s => !!s.done), secs, gate: gate.userData.open };
    const ok = writeSave(d, curSlot);
    // Zusätzlich auf dem Dev-Server sichern (saves/spielstand.json) – der App-Browser leert seinen Speicher manchmal
    if (import.meta.env && import.meta.env.DEV) { let vocabRaw = null; try { vocabRaw = localStorage.getItem('vocabquest.vocab.v1'); } catch (e) { } fetch('/__save', { method: 'POST', body: JSON.stringify({ slot: curSlot, save: d, vocabRaw, savedAt: Date.now() }) }).catch(() => { }); }
    return ok;
  }
  function applySave(d) {
    state.name = d.name || 'Held'; state.charIdx = d.charIdx || 0; Object.assign(prefs, d.prefs || {}); Object.assign(state, d.state || {});
    if (!(state.maxHp >= 50 && state.maxHp <= 500)) state.maxHp = 100; state.hp = clamp(state.hp, 0, state.maxHp); // Schutz vor kaputten Werten
    ensureState();
    $('pnameHud').textContent = state.name; $('pname').value = state.name;
    document.querySelectorAll('#char .choice').forEach(c => c.setAttribute('aria-pressed', +c.dataset.v === state.charIdx ? 'true' : 'false'));
    ['kurs', 'modus', 'tier'].forEach(g => document.querySelectorAll('#' + g + ' .choice').forEach(c => c.setAttribute('aria-pressed', c.dataset.v === prefs[g] ? 'true' : 'false')));
    if (d.hotbar) d.hotbar.forEach((v, i) => hotbar[i] = v); if (d.bags) { for (const k in bags) if (d.bags[k]) d.bags[k].forEach((v, i) => bags[k][i] = v); } else if (d.bag) { for (const k in bags) bags[k].fill(null); d.bag.forEach(v => { if (v && ITEMS[v]) { const b = bagFor(v); const f = b.indexOf(null); if (f >= 0) b[f] = v; } }); } if (d.equip) Object.assign(equip, d.equip); if (d.counts) Object.entries(d.counts).forEach(([k, n]) => { if (ITEMS[k]) ITEMS[k].n = n; });
    if (d.quests) Object.keys(qstate).forEach(k => { if (d.quests[k]) Object.assign(qstate[k], d.quests[k]); }); tracked = d.tracked || null;
    if (d.chests) d.chests.forEach((o, i) => { if (chests[i] && o) { chests[i].userData.open = true; chests[i].userData.lid.rotation.x = -1.6; } });
    if (d.stations) d.stations.forEach((o, i) => { if (stations[i] && o) { stations[i].done = true; stations[i].c.material.emissiveIntensity = .2; } });
    if (typeof d.secs === 'number' && d.state && d.state.login && d.state.login.secsDay === dayIdx()) secs = d.secs; if (d.gate) gate.userData.open = true; loginUI();
    rebuildHero(); state.mounted = true; setMount(prefs.tier); if (d.state && d.state.mounted === false) { state.mounted = true; toggleMount(); }
    if (d.pos) player.position.set(d.pos[0], d.pos[1], d.pos[2]); if (typeof d.heading === 'number') heading = d.heading;
    applyGear(hero); stats(); renderAll(); updateTracker(); hpUI();
  }
  let autosaveT = 0; function autosave() { const n = Date.now(); if (n - autosaveT > 15000 && hud.classList.contains('on')) { autosaveT = n; saveGame(); } }
  setInterval(() => { if (hud.classList.contains('on') && !uiOpen()) saveGame(); }, 30000);
  // ---------- Spielstand-Slots (3, benennbar) ----------
  let curSlot = 1;
  function renderSlots(extra) {
    const list = listSaves(); const box = $('slots'); box.innerHTML = '';
    list.forEach((d, i) => { const s = i + 1; if (!d) return; const row = document.createElement('div'); row.className = 'slotrow'; row.innerHTML = `<div class="slotinfo"><b>${d.name}</b><span>Level ${d.state ? d.state.level : 1} · ${d.state && d.state.coins !== undefined ? d.state.coins + ' 🪙' : ''} · ${fmtTime(d.savedAt)}</span></div><button class="btn primary small" data-play="${s}">Spielen</button><button class="btn small" data-del="${s}" title="Löschen">✕</button>`; box.appendChild(row); });
    box.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { const d = loadSave(+b.dataset.play); if (d) { curSlot = +b.dataset.play; applySave(d); show('world'); toast('Weiter geht\'s, ' + state.name + '!'); } });
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const s = +b.dataset.del; if (b.dataset.sure) { clearSave(s); if (import.meta.env && import.meta.env.DEV) fetch('/__save?del=' + s, { method: 'POST', body: '{}' }).catch(() => { }); renderSlots(); } else { b.dataset.sure = '1'; b.textContent = 'Wirklich löschen?'; setTimeout(() => { b.dataset.sure = ''; b.textContent = '✕'; }, 3000); } });
    const free = list.findIndex(d => !d); $('newGame').disabled = free < 0; $('startHint').textContent = free < 0 ? 'Alle 3 Spielstände belegt – einen löschen für ein neues Abenteuer' : (list.some(Boolean) ? 'Spielstand wählen oder neues Abenteuer starten' : 'Vokabeln eingeben, dann loslegen – dein Fortschritt wird gespeichert.');
  }
  (async function () {
    renderSlots();
    if (!(import.meta.env && import.meta.env.DEV)) return;
    try {
      const r = await fetch('/__save'); if (!r.ok) return; const srv = await r.json(); if (!srv) return;
      const slots = srv.slots || (srv.save ? { 1: srv.save } : {}); let restored = 0;
      Object.entries(slots).forEach(([s, sv]) => { const local = loadSave(+s); if (sv && (!local || (sv.savedAt || 0) > (local.savedAt || 0) + 60000)) { writeSave(sv, +s); restored++; } });
      if (srv.vocabRaw) { const mine = V.all().filter(w => w.unit !== 'Beispiel-Unit').length; const theirs = (JSON.parse(srv.vocabRaw).words || []).filter(w => w.unit !== 'Beispiel-Unit').length; if (theirs > mine) { localStorage.setItem('vocabquest.vocab.v1', srv.vocabRaw); V.load(); } }
      if (restored) { renderSlots(); toast('Spielstände vom Server wiederhergestellt'); }
    } catch (e) { }
  })();

  // ---------- Saison-Pass (kostenlos, alle 4 Wochen, 30 Stufen) ----------
  const SEASONS = [{ name: 'Herbstwald', icon: '🍂' }, { name: 'Eiswinter', icon: '❄️' }, { name: 'Kirschblüte', icon: '🌸' }, { name: 'Sommersee', icon: '☀️' }];
  const SEASON_ANCHOR = Date.UTC(2026, 9, 26), SEASON_LEN = 28 * 86400000, TIER_XP = 120, TIERS = 30;
  function seasonInfo() { const idx = Math.max(0, Math.floor((Date.now() - SEASON_ANCHOR) / SEASON_LEN)); const s = SEASONS[idx % SEASONS.length]; return { id: idx, name: s.name, icon: s.icon, ends: SEASON_ANCHOR + (idx + 1) * SEASON_LEN, daysLeft: Math.max(0, Math.ceil((SEASON_ANCHOR + (idx + 1) * SEASON_LEN - Date.now()) / 86400000)) }; }
  function tierReward(t) { if (t === 30) return { item: 'seasonSkin', label: 'Saison-Skin' }; if (t % 10 === 0) return { item: ['helmI', 'chestI', 'bootsI'][t / 10 - 1], label: ITEMS[['helmI', 'chestI', 'bootsI'][t / 10 - 1]].name }; if (t === 25) return { item: 'hammer', label: 'Trollhammer' }; if (t === 15) return { item: 'phoenix', label: 'Phönix-Trank' }; if (t % 5 === 0) return { item: 'bigheal', label: 'Großer Heiltrank' }; if (t % 3 === 0) return { item: 'heal', label: 'Heiltrank' }; if (t % 4 === 0) return { item: 'stam', label: 'Ausdauer-Trank' }; return { coins: 20 + t * 8, label: (20 + t * 8) + ' Münzen' }; }
  ITEMS.seasonSkin = { icon: '✨', name: 'Saison-Skin ' + seasonInfo().name, type: 'misc', r: 'gold' };
  ICON.seasonSkin = S(`<path d="M16 3l3 8 8 1-6 6 2 9-7-4-7 4 2-9-6-6 8-1z" fill="#ffd166"/><path d="M16 9l1.5 4 4 .5-3 3 1 4.5-3.5-2-3.5 2 1-4.5-3-3 4-.5z" fill="#fff4c2"/>`);
  if (!state.season) state.season = { id: seasonInfo().id, xp: 0, claimed: 0 };
  function seasonTier() { return Math.min(TIERS, Math.floor(state.season.xp / TIER_XP)); }
  function checkSeason() { const info = seasonInfo(); if (state.season.id !== info.id) { state.season = { id: info.id, xp: 0, claimed: 0 }; toast('Neue Saison: ' + info.icon + ' ' + info.name); } }
  function gainSeasonXp(n) {
    checkSeason(); state.season.xp += n; const t = seasonTier();
    if (t > state.season.claimed && t > (state.season.notified || 0)) { state.season.notified = t; toast(`🎫 Saison-Pass: Stufe ${t} erreicht – Belohnung im Saison-Pass einsammeln`); }
    if (!$('season').hidden) renderSeason();
  }
  function claimTier() { const t = seasonTier(); if (state.season.claimed >= t) return; state.season.claimed++; const n = state.season.claimed, r = tierReward(n); if (r.coins) state.coins += r.coins; else addItem(r.item); const gems = n % 5 === 0 ? 15 : 4; state.gems = (state.gems || 0) + gems; toast(`🎫 Stufe ${n} eingesammelt: ${r.label} · +${gems} 💎`); A.sfx('gem'); renderAll(); renderSeason(); saveGame(); }
  function openSeason() { checkSeason(); if (!state.season.welcome) { state.season.welcome = true; state.season.xp += TIER_XP; toast('🎁 Willkommensgeschenk: Saison-Stufe 1 freigeschaltet – jetzt einsammeln!'); } $('season').hidden = false; renderSeason(); }
  // Beim Reinladen ins Spiel einmal den Saison-Pass zeigen
  let seasonShown = false;
  const _show = show; show = function (name) { _show(name); if (name === 'world' && !seasonShown) { seasonShown = true; setTimeout(openSeason, 600); } };
  const SEASON_BG = ['linear-gradient(135deg,#3a1d08 0%,#8a4a14 55%,#1d1008 100%)', 'linear-gradient(135deg,#0d2238 0%,#2a6ea3 55%,#08131f 100%)', 'linear-gradient(135deg,#3a1030 0%,#b0487c 55%,#1a0a16 100%)', 'linear-gradient(135deg,#0a2a2a 0%,#1f8a7a 55%,#06201e 100%)'];
  function renderSeason() {
    const info = seasonInfo(), t = seasonTier(), into = state.season.xp - t * TIER_XP, open = t - state.season.claimed;
    $('seasonTitle').textContent = info.icon + ' ' + info.name; $('season').querySelector('.sp-head').style.setProperty('--sp-bg', SEASON_BG[info.id % SEASON_BG.length]);
    $('seasonMeta').innerHTML = `<span class="pill">⏳ noch ${info.daysLeft} Tage</span><span class="pill">💎 ${state.gems || 0} Kristalle</span><span class="pill">${state.season.xp} Saison-XP</span>` + (open ? `<span class="pill hot">🎁 ${open} Belohnung${open > 1 ? 'en' : ''} offen</span>` : '');
    $('seasonLvl').textContent = t; $('seasonRing').style.setProperty('--p', t >= TIERS ? 100 : into / TIER_XP * 100);
    $('seasonBar').style.width = (t >= TIERS ? 100 : into / TIER_XP * 100) + '%'; $('seasonNext').textContent = t >= TIERS ? 'Alle Stufen erreicht!' : `${into} / ${TIER_XP} XP bis Stufe ${t + 1} · Saison-XP gibt es für Stationen, Kämpfe, Quests und Truhen`;
    $('seasonGrid').innerHTML = Array.from({ length: TIERS }, (_, i) => { const n = i + 1, r = tierReward(n), st = n <= state.season.claimed ? 'done' : n <= t ? 'ready' : n === t + 1 ? 'next' : 'lock'; const big = n % 5 === 0; const gems = n % 5 === 0 ? 15 : 4; return `<div class="tier ${st} ${big ? 'big' : ''}"><div class="n">${n}</div><div class="ic">${r.item ? icon(r.item) : ICON.coin}</div><b>${r.label}</b><span class="gem">+${gems} 💎</span>${st === 'ready' && n === state.season.claimed + 1 ? '<button class="btn primary small claim">Einsammeln</button>' : st === 'lock' ? '<span class="lk">🔒</span>' : ''}</div>`; }).join('');
    const cb = $('seasonGrid').querySelector('.claim'); if (cb) cb.onclick = claimTier; $('claimAll').textContent = open ? `Alles einsammeln (${open})` : 'Alles einsammeln'; $('claimAll').classList.toggle('glow', open > 0);
    const nextEl = $('seasonGrid').querySelector('.tier.ready, .tier.next'); if (nextEl) nextEl.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  $('claimAll').onclick = () => { let k = 0; while (state.season.claimed < seasonTier() && k < 40) { claimTier(); k++; } if (!k) { const t = seasonTier(); toast(t >= TIERS ? 'Alles eingesammelt – Saison komplett!' : `Nichts offen · noch ${TIER_XP - (state.season.xp - t * TIER_XP)} Saison-XP bis Stufe ${t + 1}`); } else toast(`🎉 ${k} Stufe${k > 1 ? 'n' : ''} eingesammelt`); }; $('seasonBtn').onclick = openSeason; $('pSeason').onclick = () => { $('pause').hidden = true; openSeason(); }; $('closeSeason').onclick = () => $('season').hidden = true;

  // ---------- Statistik-Zähler + Tagesaufgaben ----------
  const DAILY_POOL = [{ id: 'words10', t: '10 Vokabeln richtig', n: 10, key: 'words', ic: '📖' }, { id: 'trolls2', t: '2 Trolle besiegen', n: 2, key: 'trolls', ic: '⚔️' }, { id: 'chests3', t: '3 Truhen öffnen', n: 3, key: 'chests', ic: '📦' }, { id: 'station1', t: '1 Vokabel-Station schaffen', n: 1, key: 'stations', ic: '📘' }, { id: 'crits5', t: '5 kritische Treffer', n: 5, key: 'crits', ic: '💥' }, { id: 'words25', t: '25 Vokabeln richtig', n: 25, key: 'words', ic: '📚' }];
  const dayIndex = () => Math.floor((Date.now() + new Date().getTimezoneOffset() * -60000) / 86400000);
  function dailyCheck() { const d = dayIndex(); if (state.daily.day !== d) { const seed = d * 9301 + 49297; const pool = [...DAILY_POOL]; const offers = []; let s = seed; for (let i = 0; i < 3; i++) { s = (s * 1103515245 + 12345) % 2147483648; offers.push(pool.splice(s % pool.length, 1)[0].id); } state.daily = { day: d, offers, chosen: null, base: 0, done: false }; } }
  function dailyTask() { return DAILY_POOL.find(x => x.id === state.daily.chosen); }
  function dailyProg() { const t = dailyTask(); return t ? Math.min(t.n, state.stats[t.key] - state.daily.base) : 0; }
  function bumpStat(key) { state.stats[key] = (state.stats[key] || 0) + 1; const t = dailyTask(); if (t && !state.daily.done && t.key === key && dailyProg() >= t.n) { state.daily.done = true; state.coins += 60; state.gems = (state.gems || 0) + 5; gainSeasonXp(60); toast('📋 Tagesaufgabe geschafft! +60 🪙 · +5 💎 · +60 Saison-XP'); renderAll(); } updateTracker(); }
  function renderDaily() { dailyCheck(); const d = state.daily; $('dailyGrid').innerHTML = d.offers.map(id => { const t = DAILY_POOL.find(x => x.id === id); const ch = d.chosen === id; const p = ch ? dailyProg() : 0; return `<div class="tier ${ch ? (d.done ? 'done' : 'ready') : d.chosen ? 'lock' : 'next'}" style="width:160px;min-height:170px;"><div class="ic" style="font-size:34px;line-height:46px;">${t.ic}</div><b>${t.t}</b><span class="gem">60 🪙 · 5 💎 · 60 Saison-XP</span>${ch ? `<span>${d.done ? '✓ erledigt' : p + ' / ' + t.n}</span>` : d.chosen ? '' : `<button class="btn primary small" data-pick="${id}">Annehmen</button>`}</div>`; }).join('');
    $('dailyGrid').querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const t = DAILY_POOL.find(x => x.id === b.dataset.pick); state.daily.chosen = t.id; state.daily.base = state.stats[t.key] || 0; state.daily.done = false; toast('Tagesaufgabe angenommen: ' + t.t); renderDaily(); updateTracker(); saveGame(); }); }
  $('dailyBtn').onclick = () => { $('daily').hidden = false; renderDaily(); }; $('closeDaily').onclick = () => $('daily').hidden = true; $('pDaily').onclick = () => { $('pause').hidden = true; $('daily').hidden = false; renderDaily(); };
  function renderStats() { const vs = V.stats ? V.stats() : {}; const s = state.stats; const row = (k, v) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`; const mins = Math.round(s.playSecs / 60); $('statsGrid').innerHTML = row('Level', state.level) + row('Spielzeit', mins + ' Min') + row('Vokabeln richtig', s.words) + row('Kritische Treffer', s.crits) + row('Beste Combo', s.bestCombo) + row('Kämpfe gewonnen', s.battles) + row('Trolle besiegt', s.trolls) + row('Truhen geöffnet', s.chests) + row('Stationen geschafft', s.stations) + row('Münzen verdient', s.coinsEarned) + row('Kristalle', state.gems || 0) + (vs.total !== undefined ? row('Wörter im Trainer', vs.total) + row('Davon mit Sternen', vs.total - vs.stars[0]) + row('Perfekt (3 Sterne)', vs.stars[3]) : ''); }
  $('pStats').onclick = () => { $('pause').hidden = true; $('statsScreen').hidden = false; renderStats(); }; $('closeStats').onclick = () => $('statsScreen').hidden = true;

  // ---------- Händler (jede volle Stunde 15 Minuten im Lager) ----------
  const merchant = new THREE.Group(); merchant.position.set(-9, groundY(-9, 5), 5); merchant.rotation.y = 2.2; scene.add(merchant);
  (function () { const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2d, roughness: .9 }); const table = new THREE.Mesh(new THREE.BoxGeometry(3, .18, 1.2), wood); table.position.y = 1; merchant.add(table); for (const [x, z] of [[-1.3, -.45], [1.3, -.45], [-1.3, .45], [1.3, .45]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.14, 1, .14), wood); leg.position.set(x, .5, z); merchant.add(leg); } for (const x of [-1.4, 1.4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.8, 6), wood); post.position.set(x, 1.4, -.6); merchant.add(post); } const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#d9403a' : '#f3e9d2'; c.fillRect(i * 32, 0, 32, 64); } const awn = new THREE.Mesh(new THREE.BoxGeometry(3.4, .08, 1.6), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: .9 })); awn.position.set(0, 2.8, -.2); awn.rotation.x = .25; merchant.add(awn); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshStandardMaterial({ color: [0xff4d6d, 0x4dc3ff, 0xffd166, 0xb48cff, 0x7cff9b][i], emissive: [0xff4d6d, 0x4dc3ff, 0xffd166, 0xb48cff, 0x7cff9b][i], emissiveIntensity: .5 })); p.position.set(-1 + i * .5, 1.22, .1); merchant.add(p); } const l = new THREE.PointLight(0xffd9a0, 1.2, 8, 2); l.position.set(0, 2.2, .5); merchant.add(l); })();
  merchant.userData.label = null;
  const merchantOpen = () => window.__shopForce || new Date().getMinutes() < 15;
  let merchantWas = null;
  function updateMerchant() { const open = merchantOpen(); merchant.visible = open; if (open && gl.mage && !merchant.userData.inst) { const inst = instance(gl.mage); inst.obj.scale.setScalar(.75); inst.obj.position.set(0, 0, -1.1); inst.obj.rotation.y = Math.PI; merchant.add(inst.obj); merchant.userData.inst = inst; anims.add(inst); inst.play('Idle'); } if (merchantWas !== null && open !== merchantWas) toast(open ? '🧙 Der Händler ist im Lager – 15 Minuten!' : 'Der Händler ist weitergezogen'); merchantWas = open; const d = new Date(); const next = open ? Math.max(1, 15 - d.getMinutes()) : 60 - d.getMinutes(); const el = $('merchantHint'); if (el) el.textContent = open ? '🧙 Händler im Lager · noch ' + next + ' Min' : '🧙 Händler in ' + next + ' Min'; }
  setInterval(updateMerchant, 1000); updateMerchant();
  const SHOP_POT = ['heal', 'bigheal', 'stam', 'phoenix'], SHOP_POW = ['shield', 'fire', 'strength', 'luck'], PRICE = { heal: [25, 0], bigheal: [60, 0], stam: [20, 0], phoenix: [0, 15], shield: [0, 8], fire: [0, 10], strength: [45, 0], luck: [0, 6], hammer: [0, 40], helmI: [120, 0], chestI: [160, 0], bootsI: [90, 0] };
  function shopOffers() { const h = Math.floor(Date.now() / 3600000); const pick = (arr, k, seed) => { const a = [...arr], out = []; let s = seed; for (let i = 0; i < k; i++) { s = (s * 1103515245 + 12345) % 2147483648; out.push(a.splice(s % a.length, 1)[0]); } return out; }; return [...pick(SHOP_POT, 2, h), ...pick(SHOP_POW, 3, h + 7), ...pick(['hammer', 'helmI', 'chestI', 'bootsI'], 1, h + 13)]; }
  function openShop() { $('shop').hidden = false; renderShop(); }
  function renderShop() { const offers = shopOffers(); $('shopMeta').innerHTML = `<span class="pill">🪙 ${state.coins}</span><span class="pill">💎 ${state.gems || 0}</span><span class="pill">⏳ ${15 - new Date().getMinutes() > 0 ? 15 - new Date().getMinutes() : 15} Min</span>`;
    $('shopGrid').innerHTML = offers.map(id => { const it = ITEMS[id], [c, g] = PRICE[id] || [50, 0]; const can = state.coins >= c && (state.gems || 0) >= g; return `<div class="tier ${can ? 'ready' : 'lock'} ${it.r === 'gold' || it.r === 'purple' ? 'big' : ''}" style="width:150px;min-height:180px;"><div class="ic">${icon(id)}</div><b>${it.name}</b><span class="gem">${it.info || (it.def ? 'Rüstung +' + it.def : it.atk ? 'Stärke ' + it.atk : '')}</span><span class="pill" style="margin-top:4px;">${c ? c + ' 🪙' : ''}${c && g ? ' + ' : ''}${g ? g + ' 💎' : ''}</span><button class="btn primary small" data-buy="${id}" ${can ? '' : 'disabled'}>Kaufen</button></div>`; }).join('');
    $('shopGrid').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const id = b.dataset.buy, [c, g] = PRICE[id] || [50, 0]; if (state.coins < c || (state.gems || 0) < g) { toast('Nicht genug ' + (state.coins < c ? 'Münzen' : 'Kristalle')); return; } state.coins -= c; state.gems = (state.gems || 0) - g; addItem(id); toast('Gekauft: ' + ITEMS[id].name); renderShop(); renderAll(); saveGame(); }); }
  $('closeShop').onclick = () => $('shop').hidden = true;
  window.__shop = () => { window.__shopForce = true; updateMerchant(); };

  // ---------- Vokabel-Menü ----------
  function openVocab() { $('vocabScreen').hidden = false; renderVocab(); }
  function renderVocab() {
    const units = V.units(); const sel = $('vUnitFilter'); const curU = sel.value; sel.innerHTML = '<option value="">Alle Units</option>' + units.map(u => `<option value="${u}">${u}</option>`).join(''); if (units.includes(curU)) sel.value = curU;
    $('vUnits').innerHTML = units.map(u => `<option value="${u}">`).join('');
    const s = V.stats(sel.value); $('vocabStats').innerHTML = `<span class="tag">${s.total} Wörter</span><span class="tag">neu ${s.unseen}</span><span class="tag">☆ ${s.stars[0]}</span><span class="tag">★ ${s.stars[1]}</span><span class="tag">★★ ${s.stars[2]}</span><span class="tag">★★★ ${s.stars[3]}</span>`;
    const list = V.byUnit(sel.value); $('vList').innerHTML = list.length ? list.map(w => `<div class="vrow ${w.seen ? '' : 'new'}"><span class="de">${w.de}</span><span>${w.en}</span><span class="st s${w.stars}">${'★'.repeat(w.stars) || '☆'}</span><button class="x" data-id="${w.id}" title="Löschen">✕</button></div>`).join('') : '<p class="hint">Noch keine Wörter. Über „Hinzufügen" oder „Liste einfügen" eintragen.</p>';
    $('vList').querySelectorAll('.x').forEach(b => b.addEventListener('click', () => { V.remove(+b.dataset.id); renderVocab(); }));
  }
  $('vUnitFilter').onchange = renderVocab;
  $('vDeleteUnit').onclick = () => { const u = $('vUnitFilter').value; if (!u) { toast('Erst eine Unit auswählen'); return; } V.removeUnit(u); $('vUnitFilter').value = ''; renderVocab(); toast('Unit gelöscht: ' + u); };
  $('vtabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('vtabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', 'false')); b.setAttribute('aria-selected', 'true'); $('vocabScreen').querySelectorAll('.tabpane').forEach(p => p.hidden = p.dataset.p !== b.dataset.t); }));
  $('vAddForm').addEventListener('submit', e => { e.preventDefault(); const w = V.add($('vDe').value, $('vEn').value, $('vUnit').value || 'Unit 1', $('vEx').value); if (w) { $('vAddMsg').textContent = `✓ ${w.de} – ${w.en}`; $('vDe').value = ''; $('vEn').value = ''; $('vEx').value = ''; $('vDe').focus(); renderVocab(); } else $('vAddMsg').textContent = 'Deutsch und Englisch ausfüllen'; });
  $('vImport').onclick = () => { const n = V.importList($('vPaste').value, $('vPasteUnit').value || 'Unit 1'); $('vPasteMsg').textContent = n ? `✓ ${n} Wörter eingefügt` : 'Nichts erkannt – Format prüfen'; if (n) { $('vPaste').value = ''; renderVocab(); } };
  $('mapBtn').onclick = () => show('map'); $('closeMap').onclick = () => show('world'); $('winBack').onclick = () => show('world');
  $('saveBtn').onclick = () => { if (saveGame()) toast('Gespeichert · Level ' + state.level); else toast('Speichern nicht möglich (Browser blockiert Speicher)'); }; $('mountBtn').onclick = toggleMount; $('useBtn').onclick = interact;
  $('vocabBtn').onclick = openVocab; $('vocabBtnStart').onclick = openVocab; $('closeVocab').onclick = () => $('vocabScreen').hidden = true; $('pVocab').onclick = () => { $('pause').hidden = true; openVocab(); };
  $('invBtn').onclick = () => { if ($('inventory').hidden) openInv(); else $('inventory').hidden = true; }; $('closeInv').onclick = () => $('inventory').hidden = true;
  $('settingsBtn').onclick = () => $('settings').hidden = false; $('respawnBtn').onclick = respawn;
  $('pResume').onclick = () => $('pause').hidden = true; $('pSettings').onclick = () => { $('pause').hidden = true; $('settings').hidden = false; }; $('pInv').onclick = () => { $('pause').hidden = true; openInv(); }; $('pMap').onclick = () => { $('pause').hidden = true; show('map'); }; $('pSave').onclick = () => { $('pause').hidden = true; if (saveGame()) toast('Gespeichert · Level ' + state.level); }; $('pMenu').onclick = () => { $('pause').hidden = true; saveGame(); renderSlots(); show('start'); };
  if (lastInput !== 'touch') { joy.style.display = 'none'; $('ctrlHint').textContent = 'W/S laufen · A/D drehen · Leertaste Rolle · F auf/absteigen · E benutzen · I Inventar · Esc Pause'; } $('closeSettings').onclick = () => $('settings').hidden = true; $('closeNpc').onclick = () => { $('npc').hidden = true; updateTracker(); };
  ['char', 'kurs', 'modus', 'tier'].forEach(g => $(g).querySelectorAll('.choice').forEach(c => c.addEventListener('click', () => { $(g).querySelectorAll('.choice').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', 'true'); if (g === 'char') { state.charIdx = +c.dataset.v; rebuildHero(); } else prefs[g] = c.dataset.v; $('modusField').hidden = prefs.kurs === 'G'; if (g === 'tier') setMount(prefs.tier); })));
  // Einstellungen
  $('stabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('stabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', 'false')); b.setAttribute('aria-selected', 'true'); document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.dataset.p !== b.dataset.t); }));
  $('sens').oninput = e => { settings.sens = +e.target.value; $('sensVal').textContent = settings.sens.toFixed(1); };
  $('camDist').oninput = e => { settings.camDist = +e.target.value; $('camVal').textContent = settings.camDist; };
  $('joySize').oninput = e => { settings.joy = +e.target.value; $('joyVal').textContent = settings.joy; joy.style.width = joy.style.height = settings.joy + 'px'; };
  $('invertCam').onchange = e => settings.invert = +e.target.value;
  $('music').oninput = e => { $('musVal').textContent = e.target.value; A.setVolumes(+e.target.value / 100, +$('sfx').value / 100); }; $('sfx').oninput = e => { $('sfxVal').textContent = e.target.value; A.setVolumes(+$('music').value / 100, +e.target.value / 100); };
  window.addEventListener('pointerdown', () => A.unlock(), { passive: true }); window.addEventListener('keydown', () => A.unlock());
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.btn, .tab, .slot, .choice')) A.sfx('click'); });
  $('fps').onchange = e => settings.fps = +e.target.value; $('showFps').onchange = e => { settings.showFps = +e.target.value; $('fpsBox').style.display = settings.showFps ? 'block' : 'none'; };
  function applyQuality(q, silent) {
    settings.quality = q; $('quality').value = String(q);
    renderer.shadowMap.enabled = q >= 2; sun.castShadow = q >= 2; sun.shadow.mapSize.set(q >= 3 ? 4096 : q === 2 ? 2048 : 1024, q >= 3 ? 4096 : q === 2 ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.setPixelRatio(q === 0 ? .5 : q === 1 ? .8 : q === 2 ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 1.5));
    water.material.roughness = q >= 2 ? .06 : .3; fireflies.visible = q >= 1; leaves.visible = q >= 2; butterflies.forEach(b => b.visible = q >= 1);
    grass.count = q === 0 ? Math.floor(GRASS / 8) : q === 1 ? Math.floor(GRASS / 2) : GRASS; scene.fog.density = q === 0 ? .0075 : .0042;
    gfx.setQuality(q);
    if (!silent) toast('Grafik: ' + ['Niedrig', 'Mittel', 'Schön', 'Sehr schön'][q] + ' · Sichtweite unverändert');
  }
  $('quality').onchange = e => applyQuality(+e.target.value);
  $('tod').onchange = e => { const v = e.target.value; if (v === 'auto') gfx.tod.paused = false; else { gfx.tod.paused = true; gfx.tod.t = { day: .45, sunset: .74, night: .04 }[v]; } };
  // Startqualität nach Grafikkarte: integrierte Intel-Grafik → Mittel, Software-Renderer → Niedrig
  (function () { try { const gl2 = renderer.getContext(); const ext = gl2.getExtension('WEBGL_debug_renderer_info'); const gpu = ext ? String(gl2.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; window.__gpu = gpu; if (/SwiftShader|Basic Render|llvmpipe/i.test(gpu)) settings.quality = 0; else if (/Mali|Adreno|Apple GPU/i.test(gpu)) settings.quality = 1; else if (/Intel|Iris|UHD/i.test(gpu)) settings.quality = 2; if (/Electron/i.test(navigator.userAgent)) settings.quality = 0; } catch (e) { } })();
  applyQuality(settings.quality, true);
  // Automatik: bei dauerhaft niedriger Bildrate eine Stufe runter
  let adaptT = performance.now(), adaptFrames = 0, adaptCooldown = 0;
  window.__adapt = (now) => { adaptFrames++; if (now - adaptT < 2000) return; const fps = adaptFrames * 1000 / (now - adaptT); adaptT = now; adaptFrames = 0; if (!hud.classList.contains('on')) return; if (fps < 28 && settings.quality > 0 && now > adaptCooldown) { adaptCooldown = now + 8000; applyQuality(settings.quality - 1, true); toast(`Ruckelt (${Math.round(fps)} FPS) · Grafik automatisch auf „${['Niedrig', 'Mittel', 'Schön', 'Sehr schön'][settings.quality]}" gestellt`); } };

  // ---------- Kampf ----------
  V.load();
  // Neues Wort zuerst zeigen (Konzept: nie ins Blaue raten)
  const introduced = new Set();
  function introWord(w, cb) {
    if (w.seen || introduced.has(w.id)) return cb();
    introduced.add(w.id); $('nwDe').textContent = w.de; $('nwEn').textContent = w.en; $('nwEx').textContent = w.ex || ''; $('newWord').hidden = false; $('nwOk').focus();
    $('nwOk').onclick = () => { $('newWord').hidden = true; cb(); };
  }
  let bossHp, bossMax, phase, combo, cur, timerId, timeLeft, battleOn = false, foe = null, foeObj = null;
  const FOES = { grunt: { name: 'Troll-Krieger', eyebrow: 'Gegner · Wald', hp: 75, xp: 40, coins: 15, phases: 1 }, imp: { name: 'Schattenwicht', eyebrow: 'Gegner · Wald · flink', hp: 55, xp: 35, coins: 18, phases: 1 }, alpha: { name: 'Troll-Häuptling', eyebrow: 'Mini-Boss · Wald', hp: 150, xp: 120, coins: 50, phases: 2 }, troll: { name: 'Waldtroll', eyebrow: 'Boss · Wald', hp: 220, xp: 300, coins: 100, phases: 2 } };
  function lev(a, b) { const m = []; for (let i = 0; i <= a.length; i++) m[i] = [i]; for (let j = 0; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; }
  function nextWord() {
    cur = V.pick(1)[0]; if (!cur) { toast('Keine Vokabeln – erst unter 📚 Vokabeln eintragen'); endBattle(); show('world'); return; }
    $('word').textContent = '…'; $('timer').style.width = '100%'; clearInterval(timerId);
    introWord(cur, () => { if (!battleOn) return; $('word').textContent = cur.de; $('answer').value = ''; $('answer').focus(); const T = prefs.kurs === 'G' ? 15 : 9; timeLeft = T; clearInterval(timerId); timerId = setInterval(() => { timeLeft -= .1; $('timer').style.width = Math.max(0, timeLeft / T * 100) + '%'; if (timeLeft <= 0) { V.record(cur.id, false); hit('bad', 'Zu langsam! Treffer kassiert.'); } }, 100); });
  }
  function startBattle(kind, obj) {
    foe = FOES[kind]; foeObj = obj || (kind === 'troll' ? troll : null); battleOn = true; bossMax = foe.hp; bossHp = foeObj && foeObj.userData.hp !== undefined ? foeObj.userData.hp : bossMax; phase = bossHp <= bossMax / 2 && foe.phases > 1 ? 2 : 1; combo = 0;
    $('bossName').textContent = foe.name; $('bossEyebrow').textContent = foe.eyebrow; $('phase').textContent = foe.phases > 1 ? 'Phase 1' : ''; $('bossHp').style.width = '100%'; $('bossHp').style.background = ''; $('feedback').textContent = ''; $('feedback').className = 'feedback';
    $('modeTag').textContent = prefs.kurs === 'G' ? 'Grundkurs' : 'Erweiterung · ' + (prefs.modus === 'S' ? 'Sanft' : 'Streng');
    hpUI(); $('bcombo').textContent = 0; if (kind === 'troll') troll.userData.body.material.color.setHex(0x5e7a3a); if (foeObj) { heading = Math.atan2(foeObj.position.x - player.position.x, foeObj.position.z - player.position.z); camYaw = 0; player.rotation.y = heading; } if (state.mounted) toggleMount(); show('battle'); if (kind === 'troll') { banner('WALDTROLL', 'Boss · Phase 1 · 2 Phasen', 'boss'); A.sfx('thunder'); } else banner(foe.name, 'Kampf · Englisch tippen = Schlag', ''); nextWord();
  }
  function endBattle() { battleOn = false; clearInterval(timerId); }
  function hit(kind, msg, dmg) {
    const fb = $('feedback'); fb.className = 'feedback ' + kind; fb.textContent = msg;
    if (kind === 'bad' && state.buffs.shield > 0) { state.buffs.shield = 0; combo = 0; fb.className = 'feedback ok'; fb.textContent = '🛡️ Schutzschild! Der Fehler kostet keine HP · richtig: ' + cur.en; $('bcombo').textContent = 0; setTimeout(nextWord, 900); return; }
    if (kind === 'bad') { combo = 0; const d = foe === FOES.troll ? 34 : foe === FOES.alpha ? 24 : 16; foeAnim('Punch', 700); A.sfx('wrong'); setTimeout(() => { heroHitAnim(); popDmg(player, '-' + d, 'bad'); camShake = .5; }, 350); damage(d); if (state.hp <= 0) { fb.textContent = 'Besiegt. Respawn am Lagerfeuer …'; return; } }
    else { combo++; const mult = (combo >= 15 ? 1.5 : combo >= 10 ? 1.25 : combo >= 5 ? 1.1 : 1) * (1 + stats().atk / 10) * (state.buffs.fire > 0 ? (state.buffs.fire--, 1.5) : 1) * (state.buffs.str > Date.now() ? 1.3 : 1); bumpStat('words'); if (kind === 'crit') bumpStat('crits'); if (combo > state.stats.bestCombo) state.stats.bestCombo = combo; const applied = Math.round(dmg * mult); bossHp = Math.max(0, bossHp - applied); if (foeObj) foeObj.userData.hp = bossHp; $('bossHp').style.width = (bossHp / bossMax * 100) + '%'; heroAttackAnim(); setTimeout(() => { foeAnim('HitReact', 600); A.sfx(kind === 'crit' ? 'crit' : 'hit'); if (foeObj) popDmg(foeObj, '-' + applied + (kind === 'crit' ? ' !' : ''), kind); camShake = kind === 'crit' ? .35 : .18; }, 260); }
    $('bcombo').textContent = combo; $('combo').textContent = combo;
    if (foe.phases > 1 && bossHp <= bossMax / 2 && phase === 1) { phase = 2; $('phase').textContent = 'Phase 2 · Wütend'; $('bossHp').style.background = 'linear-gradient(90deg,#ff3d3d,#8a0f2a)'; if (foe === FOES.troll) troll.userData.body.material.color.setHex(0x8a2f2f); toast(foe.name + ' wird wütend – stärker, anderes Aussehen!'); banner('PHASE 2', foe.name + ' ist wütend!', 'boss'); A.sfx('thunder'); }
    if (bossHp <= 0) { endBattle(); win(); return; }
    setTimeout(nextWord, 650);
  }
  function win() {
    gainXp(foe.xp); const luck = state.buffs.luck > Date.now(); state.coins += foe.coins * (luck ? 2 : 1); state.stats.coinsEarned += foe.coins * (luck ? 2 : 1); bumpStat('battles'); bumpStat('trolls'); let extra = luck ? ' · 🍀 doppelte Münzen' : '';
    if (foe === FOES.troll) { troll.userData.hp = 220; addItem('tooth'); progress('troll'); if (Math.random() < 1 / 3) { addItem('hammer'); extra = ' · Drop: Trollhammer!'; } else extra = ' · kein Drop (1 von 3)'; $('winTitle').innerHTML = 'Waldtroll <span>gefallen</span>'; $('winText').innerHTML = 'Trophäe: <b>Trollzahn</b> 🦷' + extra; }
    else { if (foeObj) { const fo = foeObj; fo.userData.alive = false; if (fo.userData.inst) { fo.userData.inst.play('Death', .1, false); setTimeout(() => { fo.visible = false; }, 1400); } else fo.visible = false; if (fo.userData.label) fo.userData.label.style.display = 'none'; setTimeout(() => { fo.userData.alive = true; fo.visible = true; fo.userData.hp = fo.userData.maxHp; }, 300000); } addItem('pelt'); if (foe === FOES.alpha) progress('alpha'); else progress('wolves'); $('winTitle').innerHTML = foe.name + ' <span>besiegt</span>'; $('winText').innerHTML = 'Trollfell erhalten · Gegner kommt in 5 Min wieder'; }
    $('winSub').textContent = `+${foe.xp} XP · +${foe.coins} 🪙`; banner(foe === FOES.troll ? 'SIEG!' : 'BESIEGT', foe.name, 'gold'); A.sfx('levelup'); renderAll(); setTimeout(() => show('win'), 600);
  }
  $('answerForm').addEventListener('submit', e => { e.preventDefault(); if (!battleOn || !cur || !$('newWord').hidden) return; clearInterval(timerId); const a = $('answer').value.trim().toLowerCase(), target = cur.en.toLowerCase(); if (a === target) { V.record(cur.id, true); hit('crit', '💥 Kritischer Treffer! Perfekt geschrieben · 2× Schaden', 20); } else if (a && lev(a, target) <= 2) { if (prefs.kurs === 'E' && prefs.modus === 'H') { V.record(cur.id, false); hit('bad', `Schreibfehler zählt als falsch · richtig: ${cur.en}`); } else { V.record(cur.id, true); hit('soft', `Fast: „${a}" → richtig: ${cur.en} · normaler Schaden`, 10); } } else { V.record(cur.id, false); hit('bad', `Falsch · richtig: ${cur.en}`); } });
  // Vokabel-Station: 6 Wörter, Ergebnis = XP
  let st = null, stTimer;
  function openStation(s) { const words = V.pick(6, null, true); if (!words.length) { toast('Keine Vokabeln – erst unter 📚 Vokabeln eintragen'); return; } st = { s, i: 0, ok: 0, words, res: [] }; $('station').hidden = false; $('sFeedback').textContent = ''; $('sFeedback').className = 'feedback'; stNext(); }
  function stNext() {
    if (st.i >= st.words.length) return stDone(); $('sCount').textContent = (st.i + 1) + ' / ' + st.words.length; $('sProg').innerHTML = st.words.map((_, k) => `<i class="${st.res[k] || ''}"></i>`).join(''); const w = st.words[st.i]; $('sWord').textContent = '…'; $('sTimer').style.width = '100%';
    introWord(w, () => { if (!st) return; $('sWord').textContent = w.de; $('sAnswer').value = ''; $('sAnswer').focus(); const T = prefs.kurs === 'G' ? 15 : 10; let left = T; clearInterval(stTimer); stTimer = setInterval(() => { left -= .1; $('sTimer').style.width = Math.max(0, left / T * 100) + '%'; if (left <= 0) stAnswer(''); }, 100); });
  }
  function stAnswer(a) { clearInterval(stTimer); const w = st.words[st.i], t = w.en.toLowerCase(), fb = $('sFeedback'); let ok = false; if (a === t) { ok = true; fb.className = 'feedback crit'; fb.textContent = '✓ Perfekt'; } else if (a && lev(a, t) <= 2 && !(prefs.kurs === 'E' && prefs.modus === 'H')) { ok = true; fb.className = 'feedback soft'; fb.textContent = `Fast: „${a}" → ${w.en}`; } else { fb.className = 'feedback bad'; fb.textContent = (a ? 'Falsch' : 'Zu langsam') + ' · richtig: ' + w.en; } V.record(w.id, ok); st.res[st.i] = ok ? 'ok' : 'bad'; if (ok) { st.ok++; bumpStat('words'); } st.i++; setTimeout(stNext, 700); }
  function stDone() { $('station').hidden = true; const n = st.words.length, xp = st.ok * 8 + (st.ok === n ? 20 : 0); st.s.done = true; bumpStat('stations'); st.s.c.material.emissiveIntensity = .2; gainXp(xp); state.coins += st.ok * 2; toast(`Station · ${st.ok}/${n} richtig · +${xp} XP · +${st.ok * 2} 🪙`); st = null; autosave(); }
  $('sForm').addEventListener('submit', e => { e.preventDefault(); if (!st) return; stAnswer($('sAnswer').value.trim().toLowerCase()); });
  $('sQuit').onclick = () => { clearInterval(stTimer); $('station').hidden = true; st = null; };

  $('dodge').onclick = () => { if (!battleOn) return; $('feedback').className = 'feedback ok'; $('feedback').textContent = 'Rolle! Attacke ausgewichen.'; };
  $('flee').onclick = () => { endBattle(); show('world'); if (Math.random() < .6) toast('Geflohen!'); else damage(10, 'Flucht misslungen'); };

  // Login-Tag: 15 Minuten Spielzeit, zählt nur Mo–Fr, einmal pro Tag – danach verschwindet der Ring bis zum nächsten Tag
  const dayIdx = () => Math.floor(Date.now() / 86400000);
  let secs = 0; if (!state.login) state.login = { day: -1, streak: 0, secsDay: -1 };
  function loginUI() { const done = state.login.day === dayIdx(); $('ringPanel').hidden = done; }
  setInterval(() => {
    if (!hud.classList.contains('on') || uiOpen()) return; const today = dayIdx(); if (state.login.day === today) return;
    if (state.login.secsDay !== today) { state.login.secsDay = today; secs = 0; }
    secs = Math.min(900, secs + 1); const m = Math.floor(secs / 60), s = String(secs % 60).padStart(2, '0'); $('ring').style.setProperty('--p', (secs / 900 * 100) + '%'); $('ring').querySelector('span').textContent = m + ':' + s;
    if (secs === 900) { const wd = new Date().getDay(); const weekday = wd >= 1 && wd <= 5; state.login.day = today; if (weekday) { state.login.streak = (state.login.lastDay !== undefined && today - state.login.lastDay <= 3) ? state.login.streak + 1 : 1; state.login.lastDay = today; const bonus = 30 + state.login.streak * 10; state.coins += bonus; gainXp(20 + state.login.streak * 5); toast(`Login-Tag ${state.login.streak} gezählt! +${bonus} 🪙 · morgen wieder`); } else toast('15 Minuten geschafft · Wochenende zählt nicht für die Serie'); loginUI(); saveGame(); }
  }, 1000);
  loginUI();

  renderAll(); updateTracker(); show('start');
  window.__vq = { renderer, scene, state, settings, player, gainXp, gfx, time: h => { gfx.tod.t = (h / 24) % 1; }, setHeading: v => { heading = v; camYaw = 0; } }; // Diagnose in der Browser-Konsole
  hideLoading(); // Welt steht – Ladebildschirm weg, unabhängig davon, ob der Browser schon Bilder zeichnet
  // Dev: Bildrate an den Dev-Server melden (perf.log), damit Ruckler auf fremden Geräten sichtbar werden
  if (import.meta.env && import.meta.env.DEV) setInterval(() => { if (!hud.classList.contains('on') || !window.__fpsNow) return; const i = renderer.info.render; fetch('/__fps', { method: 'POST', body: JSON.stringify({ fps: window.__fpsNow, q: settings.quality, pr: renderer.getPixelRatio(), calls: i.calls, tris: i.triangles, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, gpu: (window.__gpu || '').slice(0, 60), ua: navigator.userAgent.slice(-40) }) }).catch(() => { }); }, 5000);

  // ---------- Echte 3D-Modelle (GLTF, CC0: KayKit Adventurers, Quaternius Monsters; Pferd aus three.js) ----------
  setLoad('3D-Modelle werden geladen …');
  const MODELS = { knight: '/models/heroes/Knight.glb', rogue: '/models/heroes/Rogue.glb', mage: '/models/heroes/Mage.glb', barbarian: '/models/heroes/Barbarian.glb', orc: '/models/monsters/Orc.gltf', demon: '/models/monsters/Demon.gltf', bluedemon: '/models/monsters/BlueDemon.gltf', horse: '/models/animals/Horse.glb' };
  const HERO_MODEL = ['knight', 'rogue', 'mage'];
  const gl = {};
  function heroModelKey() { return HERO_MODEL[state.charIdx] || 'knight'; }
  // Held
  function setHeroModel() {
    const key = heroModelKey(); if (!gl[key]) return;
    if (heroInst) { player.remove(heroInst.obj); }
    heroInst = instance(gl[key]); heroInst.obj.scale.setScalar(.75); player.add(heroInst.obj); anims.add(heroInst); hero.visible = false; heroInst.play('Idle'); placeHero(); dressWeapons(heroInst);
  }
  function placeHero() { if (!heroInst) return; if (state.mounted) { heroInst.obj.position.set(0, mountMesh.userData.heroY !== undefined ? mountMesh.userData.heroY : mountMesh.userData.seatY - .5, .05); heroInst.obj.rotation.set(0, 0, 0); heroInst.play('Sit_Chair_Idle'); } else { heroInst.obj.position.set(0, 0, 0); heroInst.obj.rotation.set(0, 0, 0); } }
  const _rebuildHero = rebuildHero; rebuildHero = function () { _rebuildHero(); setHeroModel(); };
  const _setRiding = setRiding, _setWalking = setWalking; setRiding = function () { _setRiding(); placeHero(); }; setWalking = function () { _setWalking(); placeHero(); };
  // Inventar-Ansicht
  const _openInv = openInv; openInv = function () { _openInv(); const key = heroModelKey(); if (!gl[key]) return; if (invInst) { invScene.remove(invInst.obj); anims.delete(invInst); } invInst = instance(gl[key]); invInst.obj.scale.setScalar(.75); invScene.add(invInst.obj); anims.add(invInst); invInst.play('Idle'); dressWeapons(invInst); if (invHero) invHero.visible = false; };
  // Pferd als Reittier
  function buildHorse() {
    const g = new THREE.Group(); const inst = instance(gl.horse); inst.obj.scale.setScalar(.011); inst.obj.rotation.y = 0; inst.obj.position.y = 0; g.add(inst.obj); anims.add(inst); inst.play('horse_A_'); inst.action.paused = true;
    g.userData = { legs: [], tail: new THREE.Group(), head: new THREE.Group(), seatY: 1.75, heroY: 1.28, landSpeed: 12, waterSpeed: 3.5, inst }; return g;
  }
  const _setMount = setMount; setMount = function (kind) { if (kind === 'horse' && gl.horse) { const wasIn = mountMesh.parent; wasIn.remove(mountMesh); mountMesh = buildHorse(); wasIn.add(mountMesh); if (state.mounted) setRiding(); } else _setMount(kind); };
  // Gegner und Boss
  function dressEnemies() {
    wolves.forEach(w => { if (w.userData.inst || !gl.orc) return; const key = w.userData.alpha && gl.demon ? 'demon' : w.userData.kind === 'imp' && gl.bluedemon ? 'bluedemon' : 'orc'; w.children.forEach(c => { c.visible = false; }); const inst = instance(gl[key]); inst.obj.scale.setScalar(key === 'demon' ? 1.25 : key === 'bluedemon' ? .9 : 1.0); w.add(inst.obj); w.userData.inst = inst; anims.add(inst); inst.play('Idle'); w.scale.setScalar(1); });
    if (gl.orc && !troll.userData.inst) { troll.children.forEach(c => { c.visible = false; }); const inst = instance(gl.orc); inst.obj.scale.setScalar(2.7); inst.obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(.55); o.material.emissive = new THREE.Color(0x1a2a0a); } }); troll.add(inst.obj); troll.userData.inst = inst; anims.add(inst); inst.play('Idle'); }
    if (gl.barbarian && !npc.userData.inst) { npc.children.forEach(c => { if (c !== npc.userData.marker) c.visible = false; }); const inst = instance(gl.barbarian); inst.obj.scale.setScalar(.75); inst.obj.rotation.y = Math.PI; npc.add(inst.obj); npc.userData.inst = inst; anims.add(inst); inst.play('Idle'); }
  }
  // Waffen/Rüstung an der Figur: KayKit-Figuren bringen alle Waffen als Meshes mit – wir zeigen nur die passenden
  const WEAPON_RX = /Sword|Shield|Knife|Crossbow|Throwable|Spellbook|Wand|Staff|Axe|Mug|Helmet|Hat|Offhand/;
  const WEAPON_SETS = { sword: ['1H_Sword', 'Knife', '1H_Wand', '1H_Axe'], bow: ['2H_Crossbow', '1H_Crossbow', '2H_Staff', '2H_Axe'], hammer: ['2H_Sword', 'Knife_Offhand', '2H_Staff', '2H_Axe'] };
  function dressWeapons(inst) {
    if (!inst) return; const names = new Set();
    inst.obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && WEAPON_RX.test(o.name)) { o.visible = false; names.add(o.name); } });
    const show = (list) => { for (const n of list) if (names.has(n)) { inst.obj.traverse(o => { if (o.name === n) o.visible = true; }); return true; } return false; };
    show(WEAPON_SETS[equip.weapon] || WEAPON_SETS.sword);
    if (equip.chest) show(['Round_Shield', 'Barbarian_Round_Shield', 'Spellbook']);
    if (equip.helm) show(['Knight_Helmet', 'Mage_Hat', 'Barbarian_Hat']);
  }
  const _applyGear = applyGear; applyGear = function (h) { _applyGear(h); dressWeapons(heroInst); dressWeapons(invInst); };
  Promise.all(Object.entries(MODELS).map(([k, url]) => loadModel(url).then(g => { gl[k] = g; }).catch(e => console.warn('Modell fehlt:', k, e.message)))).then(() => { setHeroModel(); dressEnemies(); if (prefs.tier === 'horse') setMount('horse'); toast('3D-Modelle geladen'); });
})();
