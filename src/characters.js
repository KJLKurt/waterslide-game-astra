import * as THREE from 'three';
import { PALETTES } from './storage.js';

// Object3D rigs animate normally; only five InstancedMeshes are submitted for all 13 people.
export class Swimmers {
  constructor(scene, count = 13) {
    this.scene = scene;
    this.geometries = {
      sphere: new THREE.SphereGeometry(1, 10, 8),
      capsule: new THREE.CapsuleGeometry(1, 1, 4, 8),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
      ring: new THREE.TorusGeometry(0.73, 0.21, 6, 18),
      box: new THREE.BoxGeometry(1, 1, 1),
    };
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.02 });
    this.batches = {};
    for (const [type, geometry] of Object.entries(this.geometries)) {
      const batch = new THREE.InstancedMesh(geometry, this.material, count * 18);
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      batch.castShadow = true;
      this.batches[type] = batch;
      scene.add(batch);
    }
    this.rigs = Array.from({ length: count }, (_, id) => this.createRig(id));
  }
  createRig(id) {
    const root = new THREE.Object3D();
    const body = new THREE.Object3D();
    root.add(body);
    const parts = [];
    const add = (type, color, position, scale, parent = body, rotation = [0,0,0], tag = '') => {
      const node = new THREE.Object3D();
      node.position.set(...position); node.scale.set(...scale); node.rotation.set(...rotation);
      parent.add(node);
      parts.push({ type, color, node, tag });
      return node;
    };
    const palette = PALETTES[id % 4];
    const skin = palette.skin, suit = palette.color;
    add('capsule', suit, [0, 1.04, 0], [0.37, 0.32, 0.27], body, [-0.16,0,0], 'suit');
    add('sphere', skin, [0, 1.89, 0.04], [0.37, 0.40, 0.36], body, [0,0,0], 'skin');
    add('sphere', '#293f43', [0, 2.15, -0.02], [0.38, 0.17, 0.34]);
    add('sphere', skin, [0, 1.84, 0.38], [0.09, 0.09, 0.10], body, [0,0,0], 'skin');
    add('box', '#ffffff', [0, 1.72, 0.369], [0.16, 0.04, 0.025]);
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Object3D(); arm.position.set(side * 0.39, 1.30, 0); body.add(arm); arms.push(arm);
      add('capsule', skin, [side * 0.13, -0.24, 0.04], [0.115,0.24,0.12], arm, [0.15,0,side * 0.38], 'skin');
      add('sphere', skin, [side * 0.24,-0.57,0.05], [0.13,0.14,0.13], arm, [0,0,0], 'skin');
      add('capsule', skin, [side * 0.24,0.48,0.57], [0.145,0.32,0.15], body, [Math.PI / 2 - 0.1,0,0], 'skin');
      add('sphere', suit, [side * 0.24,0.39,1.00], [0.17,0.14,0.26], body, [0,0,0], 'suit');
      add('sphere', '#173c44', [side * 0.155, 1.92, 0.353], [0.057,0.074,0.023]);
      add('sphere', '#a8f7ef', [side * 0.17, 1.93, 0.36], [0.139,0.103,0.065], body, [0,0,0], 'goggles');
    }
    add('box', '#fff7dd', [0, 1.93, 0.383], [0.075, 0.045, 0.055], body, [0,0,0], 'goggles');
    add('ring', palette.ring, [0,0.52,0.06], [1.07,1.07,1.07], body, [Math.PI/2,0,0], 'ring');
    add('sphere', suit, [0,2.20,0], [0.395,0.18,0.37], body, [0,0,0], 'cap');
    add('box', suit, [0,2.18,0.35], [0.48,0.045,0.35], body, [0,0,0], 'cap');
    for (let i=-1; i<=1; i++) add('box', '#ffe17b', [i*0.2,2.34 + (i===0?0.06:0),0.1], [0.13,0.26,0.13], body, [0,0,i*0.15], 'crown');
    return { root, body, arms, parts, palette: id % 4, accessory: ['goggles','cap','classic'][id % 3] };
  }
  customize(index, palette, accessory) {
    this.rigs[index].palette = palette;
    this.rigs[index].accessory = accessory;
  }
  update(racers, track, time, menu = false, camera = null) {
    const counts = Object.fromEntries(Object.keys(this.batches).map(type => [type, 0]));
    const color = new THREE.Color();
    for (const r of racers) {
      if (r.eliminated) continue;
      // Swimmers immediately behind the chase camera should not obscure the controls/player.
      if (!menu && r.id !== 0 && camera && r.position.distanceToSquared(camera.position) < 64) continue;
      const rig = this.rigs[r.id];
      const p = PALETTES[rig.palette];
      const frame = track[r.route].sample(r.s);
      rig.root.position.copy(r.position);
      rig.root.rotation.set(0, Math.atan2(frame.tangent.x, frame.tangent.z), 0);
      rig.body.position.y = 0.11 + Math.sin(time * 7 + r.phase) * 0.055;
      rig.body.rotation.set(r.state === 'Airborne' ? -0.13 : -0.04, 0, -r.steer * 0.16 - frame.bank * 0.6);
      if (r.state === 'Falling') rig.body.rotation.z += r.fallTime * 2;
      const celebration = r.state === 'Finished';
      rig.arms.forEach((arm, i) => { arm.rotation.z = (i === 0 ? -1 : 1) * (r.state === 'Airborne' || celebration ? 2.3 : 0.3 + Math.sin(time * 3 + r.phase) * 0.06); });
      if (menu && r.id === 0) { rig.arms[1].rotation.z = 2.3 + Math.sin(time*3)*0.25; }
      rig.root.updateMatrixWorld(true);
      for (const part of rig.parts) {
        if (['goggles','cap','crown'].includes(part.tag) && part.tag !== rig.accessory) continue;
        const batch = this.batches[part.type];
        const index = counts[part.type]++;
        batch.setMatrixAt(index, part.node.matrixWorld);
        batch.setColorAt(index, color.set(part.tag === 'skin' ? p.skin : part.tag === 'suit' || part.tag === 'cap' ? p.color : part.tag === 'ring' ? p.ring : part.color));
      }
    }
    for (const [type, batch] of Object.entries(this.batches)) {
      batch.count = counts[type]; batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    }
  }
}
