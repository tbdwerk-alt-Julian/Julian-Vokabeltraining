// Grafik-Modul: moderner Himmel (Atmosphäre, Sonne, Mond, Sterne, Wolken), Tag-Nacht-Zyklus,
// Nachbearbeitung (Bloom, Kantenglättung, Farbkorrektur, Vignette), Linsenreflexe, Umgebungslicht
// aus dem Himmel, prozedurale Normal-Maps, Schnee/Nässe-Uniforms für Materialien, ferne Bergkette.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Gemeinsame Uniforms, die viele Materialien lesen (Schnee auf Oberflächen, nasser Boden)
export const WORLD_U = { snow: { value: 0 }, wet: { value: 0 }, night: { value: 0 }, time: { value: 0 }, wind: { value: 0 }, cloudT: { value: new THREE.Vector2() }, cloudShadow: { value: 0 } };

// Fügt einem Material Schnee (weiße Decke auf nach oben zeigenden Flächen) und Nässe (dunkler, glänzender) hinzu
export function weatherize(material, opts = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSnow = WORLD_U.snow; sh.uniforms.uWet = WORLD_U.wet; sh.uniforms.uCloudT = WORLD_U.cloudT; sh.uniforms.uCloudShadow = WORLD_U.cloudShadow;
    sh.vertexShader = `uniform vec2 uCloudT; uniform float uCloudShadow; varying float vCloudS;
      float wzHash(vec2 p){ return fract(sin(mod(dot(p, vec2(127.1, 311.7)), 6.28318)) * 43758.5453); }
      float wzNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wzHash(i), wzHash(i + vec2(1.0, 0.0)), f.x), mix(wzHash(i + vec2(0.0, 1.0)), wzHash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float wzFbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * wzNoise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }
      
` + sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 wpC = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpC = instanceMatrix * wpC;
        #endif
        wpC = modelMatrix * wpC; float cn = wzFbm(wpC.xz * 0.011 + uCloudT); vCloudS = 1.0 - smoothstep(0.5, 0.78, cn) * uCloudShadow; }`);
    sh.fragmentShader = 'uniform float uSnow; uniform float uWet; varying float vCloudS;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vCloudS;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, ${opts.wetRough === undefined ? '0.35' : opts.wetRough.toFixed(2)}, uWet);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 wN = vec3(dot(normal, viewMatrix[0].xyz), dot(normal, viewMatrix[1].xyz), dot(normal, viewMatrix[2].xyz));
        float snowK = uSnow * smoothstep(${opts.snowLow === undefined ? '0.35' : opts.snowLow.toFixed(2)}, 0.85, wN.y) * ${opts.snowMax === undefined ? '0.92' : opts.snowMax.toFixed(2)};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), snowK);
        diffuseColor.rgb *= 1.0 - uWet * 0.5 * (1.0 - snowK);`);
  };
  material.envMapIntensity = .55; material.needsUpdate = true; return material;
}

// Prozedurale Normal-Map aus Wertrauschen (für Boden, Fels, Wasser)
export function makeNormalTex(size, scale, strength, octaves = 4) {
  const h = new Float32Array(size * size);
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const smoothN = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = rnd(xi, yi), b = rnd(xi + 1, yi), c = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1); return lerp(lerp(a, b, u), lerp(c, d, u), v); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let v = 0, amp = 1, f = scale; for (let o = 0; o < octaves; o++) { v += smoothN(x / size * f, y / size * f) * amp; amp *= .5; f *= 2; } h[y * size + x] = v; }
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'); const img = c.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)], u = h[((y - 1 + size) % size) * size + x], dn = h[((y + 1) % size) * size + x];
    const nx = (l - r) * strength, ny = (u - dn) * strength; const len = Math.hypot(nx, ny, 1); const i = (y * size + x) * 4;
    d[i] = (nx / len * .5 + .5) * 255; d[i + 1] = (ny / len * .5 + .5) * 255; d[i + 2] = (1 / len * .5 + .5) * 255; d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// Weiche Kreis-Textur (Linsenreflexe, Sonnenglühen)
function discTex(size, stops) { const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'); const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([p, col]) => g.addColorStop(p, col)); c.fillStyle = g; c.fillRect(0, 0, size, size); return new THREE.CanvasTexture(cv); }

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.99995; }`;
const SKY_FRAG = `
uniform vec3 zenith, horizon, sunHalo, sunCol, moonDir, sunDir; uniform float time, cloud, cloudDark, flash, night, haze, envDim, envPass; varying vec3 vDir;
float hash(vec2 p){ return fract(sin(mod(dot(p, vec2(127.1, 311.7)), 6.28318)) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.55);
  vec3 c = mix(horizon, zenith, t);
  float belowH = clamp(-h * 6.0, 0.0, 1.0); c = mix(c, horizon * 0.55, belowH);
  float sd = max(dot(d, sunDir), 0.0);
  c += sunHalo * pow(sd, 6.0) * 0.35 * (1.0 - night * 0.8);
  c += sunHalo * pow(sd, 48.0) * 0.6;
  float disc = smoothstep(0.9985, 0.9992, sd); c += sunCol * disc * 2.5 * (1.0 - cloud * 0.9);
  float md = max(dot(d, moonDir), 0.0); float moon = smoothstep(0.9988, 0.9994, md); c += vec3(0.9, 0.95, 1.0) * moon * 1.6 * night; c += vec3(0.5, 0.6, 0.9) * pow(md, 40.0) * 0.25 * night;
  if (h > 0.02 && night > 0.001) { vec2 sp = d.xz / (h + 0.08) * 90.0; float st = hash(floor(sp)); float tw = 0.6 + 0.4 * sin(time * 2.0 + st * 50.0); float star = step(0.995, st) * tw * smoothstep(0.0, 0.25, h); c += vec3(star) * night * (1.0 - cloud); }
  if (h > -0.02) {
    vec2 uv = d.xz / (h + 0.3) * 0.9 + vec2(time * 0.01, time * 0.004);
    float n = fbm(uv) * 0.75 + fbm(uv * 3.1 + 7.0) * 0.25;
    float cov = smoothstep(1.0 - cloud * 1.05, 1.0 - cloud * 1.05 + 0.28, n);
    float fade = smoothstep(0.03, 0.25, h);
    float lit = 0.55 + 0.45 * sd; vec3 cc = mix(vec3(1.0, 0.98, 0.95) * lit, vec3(0.28, 0.3, 0.34), cloudDark);
    cc = mix(cc, cc * vec3(0.35, 0.4, 0.55), night); cc += sunHalo * pow(sd, 4.0) * 0.25 * (1.0 - cloudDark);
    float thick = smoothstep(0.0, 0.6, n - (1.0 - cloud * 1.05)); cc *= 1.0 - thick * 0.35 * (0.4 + cloudDark);
    c = mix(c, cc, cov * fade * 0.96);
  }
  c = mix(c, horizon, haze * (1.0 - t) * 0.5);
  c += vec3(flash); c *= envDim;
  c = max(c, vec3(0.0)); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = horizon;
  gl_FragColor = envPass > 0.5 ? linearToOutputTexel(vec4(c, 1.0)) : vec4(c, 1.0); // PMREM-Ziel ist RGBE-kodiert: ohne Kodierung wird die Umgebungs-Map unbrauchbar (alles schwarz); im Hauptbild bleibt der Himmel wie abgestimmt
}`;

const SHAFTS = {
  uniforms: { tDiffuse: { value: null }, sunPos: { value: new THREE.Vector2(.5, .5) }, strength: { value: 0 }, decay: { value: .94 }, density: { value: .9 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 sunPos; uniform float strength, decay, density; varying vec2 vUv;
  void main(){ vec4 base = texture2D(tDiffuse, vUv); if (strength <= 0.001) { gl_FragColor = base; return; }
    vec2 delta = (vUv - sunPos) * density / 16.0; vec2 uv = vUv; float w = 1.0; vec3 acc = vec3(0.0);
    for (int i = 0; i < 16; i++) { uv -= delta; vec3 s = texture2D(tDiffuse, uv).rgb; float l = dot(s, vec3(0.3, 0.59, 0.11)); acc += s * smoothstep(0.55, 1.0, l) * w; w *= decay; }
    acc /= 16.0; gl_FragColor = vec4(base.rgb + acc * strength * vec3(1.0, 0.92, 0.75), 1.0); }`
};
const GRADE = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, vig: { value: .42 }, sat: { value: 1.1 }, con: { value: 1.12 }, time: { value: 0 }, grain: { value: .025 }, aber: { value: .0015 }, flash: { value: 0 }, warm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float vig, sat, con, time, grain, aber, flash, warm; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(mod(dot(p, vec2(12.9898, 78.233)), 6.28318)) * 43758.5453); }
  void main(){ vec2 d = vUv - 0.5; vec3 c;
    c.r = texture2D(tDiffuse, vUv + d * aber).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - d * aber).b;
    float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat); c = (c - 0.5) * con + 0.5;
    c = mix(c, c * vec3(1.06, 0.98, 0.9), warm);
    c *= 1.0 - vig * smoothstep(0.3, 1.15, length(d) * 1.55);
    c += (hash(vUv * res + fract(time)) - 0.5) * grain;
    c += flash; gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`
};

export function setupGraphics({ renderer, scene, camera, sun, hemi, stage }) {
  // ---- Himmel ----
  const U = {
    zenith: { value: new THREE.Color(0x2b63b5) }, horizon: { value: new THREE.Color(0xbcd7ea) }, sunHalo: { value: new THREE.Color(0xffd9a0) }, sunCol: { value: new THREE.Color(0xfff4dc) },
    sunDir: { value: new THREE.Vector3(-.5, .35, -.78).normalize() }, moonDir: { value: new THREE.Vector3(.5, .3, .78).normalize() }, time: { value: 0 }, cloud: { value: .3 }, cloudDark: { value: 0 }, flash: { value: 0 }, night: { value: 0 }, haze: { value: .3 }, envDim: { value: 1 }, envPass: { value: 0 }
  };
  const skyMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), skyMat); skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);
  // Umgebungslicht/Reflexionen aus dem Himmel (wird bei Wetter- und Tageszeitwechsel erneuert)
  const pmrem = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat); envScene.add(envSky);
  let envTex = null, envAge = 99;
  function refreshEnv() { try { U.envDim.value = 1; U.envPass.value = 1; const t = pmrem.fromScene(envScene, .03).texture; U.envPass.value = 0; U.envDim.value = 1; if (envTex) envTex.dispose(); envTex = t; scene.environment = t; envAge = 0; } catch (e) { } }
  refreshEnv();

  // Sonnenglühen + Linsenreflexe
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(256, [[0, 'rgba(255,250,235,1)'], [.15, 'rgba(255,240,200,.75)'], [.45, 'rgba(255,205,140,.2)'], [1, 'rgba(255,190,120,0)']]), transparent: true, depthWrite: false, depthTest: true, fog: false, opacity: .85, blending: THREE.AdditiveBlending })); glow.scale.set(70, 70, 1); glow.renderOrder = -9; scene.add(glow);
  const flare = new Lensflare();
  const fTex = discTex(128, [[0, 'rgba(255,255,255,.9)'], [.4, 'rgba(255,230,200,.35)'], [1, 'rgba(255,220,180,0)']]), fTex2 = discTex(128, [[0, 'rgba(255,255,255,0)'], [.72, 'rgba(255,255,255,0)'], [.8, 'rgba(180,220,255,.6)'], [1, 'rgba(180,220,255,0)']]);
  flare.addElement(new LensflareElement(fTex, 260, 0, new THREE.Color(0xfff2d6))); flare.addElement(new LensflareElement(fTex2, 90, .35, new THREE.Color(0xb9e2ff))); flare.addElement(new LensflareElement(fTex, 60, .55, new THREE.Color(0xffd1a8))); flare.addElement(new LensflareElement(fTex2, 140, .8, new THREE.Color(0xd4f0ff))); flare.addElement(new LensflareElement(fTex, 40, 1.05, new THREE.Color(0xfff0c8)));
  const flareHolder = new THREE.Object3D(); flareHolder.add(flare); scene.add(flareHolder);

  // ---- Nachbearbeitung ----
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.texture.encoding = THREE.sRGBEncoding; composer.renderTarget2.texture.encoding = THREE.sRGBEncoding;
  const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .42, .55, .82); composer.addPass(bloom);
  const shafts = new ShaderPass(SHAFTS); composer.addPass(shafts);
  const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
  const grade = new ShaderPass(GRADE); composer.addPass(grade);
  let usePost = true, quality = 2;

  // ---- Tageszeit ----
  const tod = { t: .34, speed: 1 / 1500, paused: false }; // 0 = Mitternacht, .25 Sonnenaufgang, .5 Mittag, .75 Sonnenuntergang · ein Tag = 25 Minuten
  const COL = {
    dayZ: new THREE.Color(0x1d4fae), dayH: new THREE.Color(0x8db9de), dawnZ: new THREE.Color(0x3b4f8a), dawnH: new THREE.Color(0xffb27a), nightZ: new THREE.Color(0x04060f), nightH: new THREE.Color(0x141d33),
    sunDay: new THREE.Color(0xfff1d8), sunLow: new THREE.Color(0xffa24d), moon: new THREE.Color(0x7f93c8), haloDay: new THREE.Color(0xffe1b0), haloLow: new THREE.Color(0xff8a3c)
  };
  const wx = { cloud: .3, cloudDark: 0, dim: 1, fogMul: 1, fogTint: new THREE.Color(1, 1, 1), tint: new THREE.Color(1, 1, 1), tintZ: new THREE.Color(0, 0, 0), tintH: new THREE.Color(0, 0, 0), tintMix: 0 }; // vom Wetter gesetzt
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function sunElevation() { return Math.sin((tod.t - .25) * Math.PI * 2); }
  function updateSky(dt, playerPos) {
    if (!tod.paused) tod.t = (tod.t + dt * tod.speed) % 1;
    const ang = (tod.t - .25) * Math.PI * 2; const e = Math.sin(ang);
    U.sunDir.value.set(Math.cos(ang) * .75, e, -.55).normalize(); U.moonDir.value.copy(U.sunDir.value).negate(); U.moonDir.value.x *= .6; U.moonDir.value.normalize();
    const day = clamp(e * 3.2, 0, 1), low = clamp(1 - Math.abs(e) * 4.5, 0, 1), night = clamp(-e * 5, 0, 1);
    U.night.value = night; WORLD_U.night.value = night;
    // Himmelsfarben: Tag ↔ Dämmerung ↔ Nacht
    tmpA.copy(COL.nightZ).lerp(COL.dawnZ, 1 - night).lerp(COL.dayZ, day); tmpB.copy(COL.nightH).lerp(COL.dawnH, 1 - night).lerp(COL.dayH, day);
    // Wetter trübt: Wolken grau, Himmel entsättigt
    const grey = wx.cloudDark; tmpA.lerp(tmpB, grey * .5); tmpA.multiplyScalar(1 - grey * .45); tmpB.multiplyScalar(1 - grey * .35); tmpB.lerp(new THREE.Color(.55, .58, .62).multiplyScalar(1 - night * .8), grey * .6);
    if (wx.tintMix) { tmpA.lerp(wx.tintZ, wx.tintMix); tmpB.lerp(wx.tintH, wx.tintMix); }
    U.zenith.value.copy(tmpA); U.horizon.value.copy(tmpB);
    U.sunHalo.value.copy(COL.haloDay).lerp(COL.haloLow, low).multiplyScalar(1 - grey * .7); U.sunCol.value.copy(COL.sunDay).lerp(COL.sunLow, low);
    U.cloud.value = wx.cloud; U.cloudDark.value = wx.cloudDark; U.time.value += dt; U.haze.value = .18 + grey * .4;
    // Licht
    const sunI = (day * 1.9 * (1 - grey * .7) + low * .5) * wx.dim; const moonI = night * .32;
    if (e > -.03) { sun.position.copy(U.sunDir.value).multiplyScalar(90).add(playerPos); sun.color.copy(COL.sunDay).lerp(COL.sunLow, low); sun.intensity = Math.max(sunI, .05); }
    else { sun.position.copy(U.moonDir.value).multiplyScalar(90).add(playerPos); sun.color.copy(COL.moon); sun.intensity = moonI + .05; }
    sun.target.position.copy(playerPos); sun.target.updateMatrixWorld();
    hemi.color.copy(U.zenith.value).lerp(U.horizon.value, .5).multiplyScalar(1.25).lerp(new THREE.Color(0x7386b8), night); hemi.groundColor.setHex(0x3b5a2a).lerp(new THREE.Color(0x1c2436), night).lerp(new THREE.Color(.3, .32, .35), grey * .5);
    hemi.intensity = (.45 + day * .2 + low * .25) * (1 - night * .25) * (1 - grey * .15) + night * .1;
    // Nebel in Horizontfarbe
    scene.fog.color.copy(U.horizon.value).multiply(wx.fogTint); scene.fog.density = (.0042 + grey * .003) * wx.fogMul;
    renderer.toneMappingExposure = (1.0 + night * .15 - grey * .05) * (wx.exposure || 1);
    // Sonne/Himmel folgen der Kamera
    skyMesh.position.copy(camera.position);
    glow.position.copy(camera.position).addScaledVector(e > -.03 ? U.sunDir.value : U.moonDir.value, 500); glow.material.opacity = e > -.03 ? (1 - grey * .85) : night * .5; glow.scale.setScalar(e > -.03 ? 70 + low * 40 : 40);
    flareHolder.position.copy(camera.position).addScaledVector(U.sunDir.value, 480); flare.visible = usePost && quality >= 2 && e > .02 && grey < .5;
    grade.uniforms.warm.value = low * .5 + (wx.warm || 0); grade.uniforms.vig.value = .4 + night * .15 + grey * .1;
    WORLD_U.cloudT.value.x += dt * .006; WORLD_U.cloudT.value.y += dt * .002; WORLD_U.cloudShadow.value = Math.min(.55, wx.cloud * .6) * day * (1 - grey * .6);
    WORLD_U.time.value += dt;
    // Sonnenstrahlen: Sonne auf den Bildschirm projizieren
    if (shafts.enabled) { const sp = U.sunDir.value.clone().multiplyScalar(1000).add(camera.position).project(camera); const inFront = sp.z < 1 && Math.abs(sp.x) < 1.6 && Math.abs(sp.y) < 1.6; shafts.uniforms.sunPos.value.set(sp.x * .5 + .5, sp.y * .5 + .5); const edge = inFront ? Math.max(0, 1 - Math.max(Math.abs(sp.x), Math.abs(sp.y)) * .55) : 0; shafts.uniforms.strength.value = edge * .55 * day * (1 - grey * .9) * (1 - night); }
    envAge += dt; if (envAge > 12) refreshEnv();
    return { day, low, night, e };
  }

  // ---- Ferne Bergkette (ersetzt Kegel-Berge) ----
  function buildFarMountains(innerR, outerR, peak, colorRock, colorSnow) {
    const SEG = 220, ROWS = 7, pos = [], col = [], idx = [];
    const n2 = (a, k) => Math.sin(a * k) * Math.cos(a * k * .37 + 1.3) * .5 + .5;
    for (let r = 0; r <= ROWS; r++) for (let s = 0; s <= SEG; s++) {
      const a = s / SEG * Math.PI * 2, rr = r / ROWS, rad = lerp(innerR, outerR, rr);
      const prof = Math.sin(rr * Math.PI) * (rr < .5 ? 1 : 1 - (rr - .5) * .4);
      const ridge = .35 + .65 * (n2(a, 9) * .5 + n2(a, 23) * .3 + n2(a, 51) * .2);
      let y = peak * ridge * prof * (1 + .18 * Math.sin(a * 97 + rr * 7)); if (r === 0 || r === ROWS) y = -20;
      pos.push(Math.cos(a) * rad, y - 2, Math.sin(a) * rad);
      const snow = clamp((y - peak * .42) / (peak * .25), 0, 1); const c = new THREE.Color(colorRock).lerp(new THREE.Color(colorSnow), snow).offsetHSL(0, 0, (Math.sin(a * 131 + rr * 5) - .5) * .05);
      col.push(c.r, c.g, c.b);
    }
    for (let r = 0; r < ROWS; r++) for (let s = 0; s < SEG; s++) { const a = r * (SEG + 1) + s, b = a + SEG + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, weatherize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), { snowMax: .85 })); m.frustumCulled = false; scene.add(m); return m;
  }
  buildFarMountains(380, 760, 230, 0x56657a, 0xeef3fa); buildFarMountains(330, 520, 120, 0x47604f, 0xe4ecf3);

  // ---- Qualität / Größe ----
  function setQuality(q) {
    quality = q; usePost = q >= 1;
    bloom.enabled = q >= 2; shafts.enabled = q >= 2; bloom.strength = q >= 3 ? .5 : .38; bloom.resolution.set(q >= 3 ? 768 : 384, q >= 3 ? 768 : 384);
    grade.uniforms.aber.value = q >= 2 ? .0015 : 0; grade.uniforms.grain.value = q >= 2 ? .022 : 0;
    skyMesh.geometry = q >= 2 ? new THREE.SphereGeometry(600, 48, 24) : new THREE.SphereGeometry(600, 24, 12);
    renderer.shadowMap.type = q >= 3 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    setSize();
  }
  function setSize() { const w = stage.clientWidth, h = stage.clientHeight, pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); composer.setSize(w, h); fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); grade.uniforms.res.value.set(w * pr, h * pr); }
  function render(dt) { grade.uniforms.time.value += dt; if (usePost) composer.render(dt); else renderer.render(scene, camera); }
  function flash(v) { U.flash.value = v; grade.uniforms.flash.value = v * .35; }

  return { skyMesh, U, wx, tod, updateSky, setQuality, setSize, render, flash, refreshEnv, composer, bloom, grade, shafts, sunElevation };
}
