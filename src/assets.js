// Laden von GLTF/GLB-Modellen und Erzeugen animierter Instanzen.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

export function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => loader.load(url, g => {
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.map) o.material.map.encoding = THREE.sRGBEncoding; } });
      resolve(g);
    }, undefined, reject)));
  }
  return cache.get(url);
}

// Erzeugt eine eigenständige Kopie (eigenes Skelett) mit eigenem Mixer.
export function instance(gltf) {
  const obj = SkeletonUtils.clone(gltf.scene);
  const mixer = new THREE.AnimationMixer(obj);
  const clips = {};
  gltf.animations.forEach(c => { clips[c.name] = c; });
  const inst = { obj, mixer, clips, current: null, action: null };
  inst.play = (name, fade = .2, loop = true) => {
    const clip = clips[name] || Object.values(clips).find(c => c.name.toLowerCase().includes(name.toLowerCase()));
    if (!clip) return false;
    if (inst.current === clip.name) return true;
    const next = mixer.clipAction(clip); next.reset(); next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); next.clampWhenFinished = !loop; next.enabled = true; next.setEffectiveWeight(1); next.play();
    if (inst.action) inst.action.crossFadeTo(next, fade, false);
    inst.action = next; inst.current = clip.name; return true;
  };
  inst.update = dt => mixer.update(dt);
  return inst;
}

export function size(obj) { const b = new THREE.Box3().setFromObject(obj); const s = new THREE.Vector3(); b.getSize(s); return { box: b, size: s }; }
