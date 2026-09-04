import * as THREE from 'three';

export const UP = new THREE.Vector3(0, 1, 0);
export const WIDTH = 10;
export const EDGE = WIDTH / 2 - 0.4;
export const GRAVITY = 19;
export const clamp = THREE.MathUtils.clamp;

export class Route {
  constructor(points, id = 'main') {
    this.id = id;
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.curve.arcLengthDivisions = 1600;
    this.length = this.curve.getLength();
    this.count = Math.ceil(this.length / 1.25);
    this.samples = [];
    for (let i = 0; i <= this.count; i++) {
      const t = i / this.count;
      const position = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const before = this.curve.getTangentAt(Math.max(0, t - 0.012));
      const after = this.curve.getTangentAt(Math.min(1, t + 0.012));
      const bank = clamp(before.clone().cross(after).y * 1.5, -0.30, 0.30);
      const right = tangent.clone().cross(UP).normalize().applyAxisAngle(tangent, bank);
      const normal = right.clone().cross(tangent).normalize();
      this.samples.push({ s: t * this.length, position, tangent, right, normal, bank, width: WIDTH });
    }
  }
  sample(s) {
    const f = clamp(s / this.length, 0, 1) * this.count;
    const a = this.samples[Math.floor(f)];
    const b = this.samples[Math.min(this.count, Math.floor(f) + 1)];
    const t = f % 1;
    return {
      position: a.position.clone().lerp(b.position, t),
      tangent: a.tangent.clone().lerp(b.tangent, t).normalize(),
      right: a.right.clone().lerp(b.right, t).normalize(),
      normal: a.normal.clone().lerp(b.normal, t).normalize(),
      bank: THREE.MathUtils.lerp(a.bank, b.bank, t), width: WIDTH,
    };
  }
  surface(s, u) {
    const frame = this.sample(s);
    return frame.position.addScaledVector(frame.right, u).addScaledVector(frame.normal, 0.065 * u * u + this.rampHeight(s));
  }
  rampHeight(s) { return Math.max(0, ...(this.ramps || []).map(ramp => s > ramp - 8 && s <= ramp ? ((s - ramp + 8) / 8) ** 2 * 1.2 : 0)); }
}

export function createTrack() {
  const points = [[0,74,18],[0,72,-18],[5,67,-58],[45,59,-92],[76,54,-120],[48,50,-156],[-18,46,-152],[-57,41,-181],[-40,35,-225],[23,29,-237],[64,24,-264],[47,19,-301],[-5,13,-318],[-38,8,-356],[-10,5,-396]].map(p => new THREE.Vector3(...p));
  const main = new Route(points);
  main.ramps = [main.length * 0.18, main.length * 0.69];
  const start = main.length * 0.295;
  const end = main.length * 0.525;
  const a = main.sample(start), b = main.sample(end);
  const middle = a.position.clone().lerp(b.position, 0.5);
  const shortcut = new Route([a.position, a.position.clone().addScaledVector(a.tangent, 9), middle, b.position.clone().addScaledVector(b.tangent, -9), b.position], 'shortcut');
  shortcut.start = start;
  shortcut.end = end;
  shortcut.gap = [8, 21];
  return {
    main, shortcut,
    length: main.length,
    ramps: main.ramps,
    checkpoints: [0, main.length * 0.23, main.length * 0.55, main.length * 0.77],
    progress(racer) {
      const s = racer.route === 'shortcut' ? start + (racer.s / shortcut.length) * (end - start) : racer.s;
      return clamp(s / main.length, 0, 1);
    },
  };
}

function stripGeometry(route, from, to, minU, maxU, color, crossSteps = 10) {
  const rows = Math.max(2, Math.ceil((to - from) / 1.5));
  const positions = [], colors = [], indices = [];
  const c = new THREE.Color(color);
  for (let i = 0; i <= rows; i++) {
    const s = THREE.MathUtils.lerp(from, to, i / rows);
    const frame = route.sample(s);
    for (let j = 0; j <= crossSteps; j++) {
      const u = THREE.MathUtils.lerp(minU, maxU, j / crossSteps);
      const h = 0.065 * u * u + route.rampHeight(s);
      const p = frame.position.clone().addScaledVector(frame.right, u).addScaledVector(frame.normal, h);
      positions.push(p.x, p.y, p.z);
      const tint = 1 - Math.abs(u) / 70 + Math.sin(s * 0.42) * 0.012;
      colors.push(c.r * tint, c.g * tint, c.b * tint);
      if (i < rows && j < crossSteps) {
        const k = i * (crossSteps + 1) + j;
        indices.push(k, k + crossSteps + 1, k + 1, k + 1, k + crossSteps + 1, k + crossSteps + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildTrackMeshes(track, scene) {
  const surfaceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.27, metalness: 0.06, side: THREE.DoubleSide });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#ff987e', roughness: 0.34 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: '#fff1d9', roughness: 0.35 });
  const chunks = { main: [], shortcut: [] };
  for (const route of [track.main, track.shortcut]) {
    let ranges = route.id === 'shortcut' ? [[0, 8], [21, route.length]] : [[0, route.length]];
    for (const [from, to] of ranges) {
      for (let s = from; s < to; s += 24) {
        const end = Math.min(s + 24, to);
        const floor = new THREE.Mesh(stripGeometry(route, s, end, -5, 5, route.id === 'main' ? '#94eee1' : '#d2ed79'), surfaceMaterial);
        floor.receiveShadow = true;
        floor.userData = { from: s, to: end };
        chunks[route.id].push(floor);
        scene.add(floor);
      }
      for (const side of [-1, 1]) {
        const path = [];
        const rim = [];
        for (let s = from; s < to; s += 2) {
          path.push(route.surface(s, side * 5.18));
          rim.push(route.surface(s, side * 5.35).add(new THREE.Vector3(0, 0.48, 0)));
        }
        path.push(route.surface(to, side * 5.18));
        rim.push(route.surface(to, side * 5.35).add(new THREE.Vector3(0, 0.48, 0)));
        for (const [pts, radius, mat] of [[path, 0.72, wallMaterial], [rim, 0.18, railMaterial]]) {
          const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.ceil((to-from) / 1.5), radius, 5, false), mat);
          mesh.castShadow = true;
          scene.add(mesh);
        }
      }
    }
  }
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const hits = [];
  scene.updateMatrixWorld(true);
  return {
    chunks,
    height(routeId, s, position) {
      ray.set(new THREE.Vector3(position.x, position.y + 7, position.z), down);
      ray.far = 40;
      hits.length = 0;
      for (const chunk of chunks[routeId]) {
        if (s >= chunk.userData.from - 3 && s <= chunk.userData.to + 3) ray.intersectObject(chunk, false, hits);
      }
      return hits.length ? Math.max(...hits.map(hit => hit.point.y)) : null;
    },
  };
}
