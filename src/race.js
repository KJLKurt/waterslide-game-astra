import * as THREE from 'three';
import { EDGE, GRAVITY, clamp } from './track.js';

const NAMES = ['You', 'Coco', 'Finn', 'Sunny', 'Rio', 'Poppy', 'Kai', 'Milo', 'Luna', 'Ziggy', 'Nori', 'Cleo', 'Remy'];
export const STATES = { SLIDING: 'Sliding', AIRBORNE: 'Airborne', FALLING: 'Falling', FINISHED: 'Finished' };
export class Race {
  constructor(track, height, random = Math.random) {
    this.track = track;
    this.height = height;
    this.random = random;
    this.events = [];
    this.reset(false);
  }
  reset(practice) {
    this.practice = practice;
    this.time = 0;
    this.countdown = 3;
    this.mode = 'countdown';
    this.events = [];
    this.racers = NAMES.map((name, id) => {
      const s = 10 + Math.floor((12 - id) / 3) * 2.5;
      const u = ((id % 3) - 1) * 2.35;
      const position = this.track.main.surface(s, u);
      return { id, name, s, u, speed: 0, vy: 0, position, state: 'Sliding', route: 'main',
        skill: 0.5 + this.random() * 0.48, risk: this.random(), aggression: this.random(),
        target: u * 0.5, phase: this.random() * Math.PI * 2, steer: 0,
        checkpoint: 12, cooldown: 0, airTime: 0, miss: 0, fallTime: 0,
        finishTime: null, eliminated: false, decided: false, wantsShortcut: false,
        shortcutUsed: false, shortcutCompleted: false, failedJump: false, jumpedRamps: [], respawns: 0,
      };
    });
    // The player starts on the third row, with room to overtake either side.
    Object.assign(this.racers[0], { s: 15, u: 0, skill: 1 });
    this.racers[0].position.copy(this.track.main.surface(15, 0));
  }
  get player() { return this.racers[0]; }
  order() {
    return [...this.racers].sort((a, b) => {
      if (a.finishTime !== null || b.finishTime !== null) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return this.track.progress(b) - this.track.progress(a) || b.speed - a.speed;
    });
  }
  placement(r = this.player) { return this.order().indexOf(r) + 1; }
  jump(r, impulse = 8.5) {
    if (r.state !== 'Sliding' || r.cooldown > 0) return false;
    const inZone = r.route === 'main' && Math.abs(r.s - this.track.shortcut.start) < 16;
    r.state = 'Airborne';
    r.vy = inZone ? 11.5 : impulse;
    r.airTime = 0;
    r.cooldown = 0.9;
    this.events.push({ type: 'jump', id: r.id });
    return true;
  }
  fall(r) {
    if (r.state === 'Falling') return;
    r.state = 'Falling';
    r.vy = Math.min(r.vy, 1);
    r.fallTime = 0;
    this.events.push({ type: 'fall', id: r.id, position: r.position.clone() });
  }
  ai(r, dt) {
    const branch = this.track.shortcut;
    if (!r.decided && r.route === 'main' && r.s > branch.start - 26) {
      r.decided = true;
      const urgency = this.placement(r) / 13;
      r.wantsShortcut = this.random() < r.risk * 0.65 + r.skill * 0.15 + urgency * 0.12;
      r.failedJump = r.wantsShortcut && this.random() > r.skill * 0.80 + 0.17;
    }
    let target = Math.sin(this.time * (0.37 + r.aggression * 0.15) + r.phase) * (0.8 + r.aggression);
    if (r.route === 'main' && r.wantsShortcut && r.s > branch.start - 26 && r.s < branch.start + 2) target = 2.8;
    if (r.route === 'shortcut') target = r.failedJump && r.s < 32 ? 5.4 : 0;
    for (const other of this.racers) {
      if (r.id === other.id || r.route !== other.route || other.eliminated) continue;
      if (other.s > r.s && other.s - r.s < 7 && Math.abs(other.u - r.u) < 1.2) {
        target += (r.u >= other.u ? 1 : -1) * r.aggression * 0.9;
        break;
      }
    }
    target = clamp(target, -4.2, r.failedJump ? 5.4 : 4.2);
    r.target = THREE.MathUtils.damp(r.target, target, 2.5, dt);
    r.steer = clamp((r.target - r.u) * (0.65 + r.skill), -1, 1);
    if (r.wantsShortcut && r.route === 'main' && r.s >= branch.start - 5 && r.s < branch.start) this.jump(r);
  }
  update(dt, input = { steer: 0, jump: false }, sensitivity = 1) {
    if (this.mode === 'paused' || this.mode === 'menu') return;
    if (this.mode === 'countdown') {
      const prev = Math.ceil(this.countdown);
      this.countdown = Math.max(0, this.countdown - dt);
      if (Math.ceil(this.countdown) !== prev) this.events.push({ type: 'count', value: Math.ceil(this.countdown) });
      if (this.countdown === 0) { this.mode = 'racing'; this.events.push({ type: 'go' }); }
      return;
    }
    this.time += dt;
    for (const r of this.racers) {
      if (r.eliminated || r.state === 'Finished') continue;
      r.cooldown = Math.max(0, r.cooldown - dt);
      if (r.state === 'Falling') {
        r.fallTime += dt;
        r.vy -= GRAVITY * dt;
        r.position.y += r.vy * dt;
        const frame = this.track[r.route].sample(r.s);
        r.position.addScaledVector(frame.tangent, r.speed * dt * 0.35);
        if (r.fallTime > 1.35) {
          if (this.practice) {
            Object.assign(r, { s: r.checkpoint, u: 0, route: 'main', state: 'Sliding', speed: 12, vy: 0, miss: 0, fallTime: 0, cooldown: 0.5, failedJump: false, decided: r.checkpoint > this.track.shortcut.end, wantsShortcut: false });
            r.position.copy(this.track.main.surface(r.s, 0));
            r.jumpedRamps = r.jumpedRamps.filter(index => this.track.ramps[index] < r.checkpoint);
            r.respawns++;
            this.events.push({ type: 'respawn', id: r.id });
          } else {
            r.eliminated = true;
            this.events.push({ type: 'eliminated', id: r.id });
          }
        }
        continue;
      }
      if (r.id) this.ai(r, dt);
      else { r.steer = clamp(input.steer * sensitivity, -1.7, 1.7); if (input.jump) this.jump(r); }
      let route = this.track[r.route];
      const frame = route.sample(r.s);
      const centerBoost = Math.abs(r.u) < 1.2 ? 1.6 : 0;
      const topSpeed = (r.id ? 21.3 + r.skill * 4.7 : 25.4) + centerBoost + Math.max(0, -frame.tangent.y) * 8;
      r.speed = THREE.MathUtils.damp(r.speed, topSpeed - Math.abs(r.steer) * 0.8, 0.6, dt);
      // Gentle traffic spacing: steer around a swimmer to pass instead of clipping through them.
      if (r.state === 'Sliding') for (const other of this.racers) {
        if (other.id === r.id || other.route !== r.route || other.state !== 'Sliding' || other.eliminated) continue;
        const ahead = other.s - r.s, lateral = r.u - other.u;
        if (ahead > 0 && ahead < 2.0 && Math.abs(lateral) < 1.35) {
          r.speed = Math.min(r.speed, Math.max(8, other.speed * 0.97));
          r.u += (lateral === 0 ? (r.id % 2 ? 1 : -1) : Math.sign(lateral)) * dt * 0.85;
        }
      }
      const previousS = r.s;
      r.s += r.speed * dt;
      r.u = clamp(r.u + r.steer * (r.state === 'Airborne' ? 2.8 : 6.2) * dt, -8, 8);
      if (r.route === 'main') {
        for (const cp of this.track.checkpoints) if (r.s >= cp && cp > r.checkpoint && r.state === 'Sliding') r.checkpoint = cp;
        for (let i = 0; i < this.track.ramps.length; i++) {
          const ramp = this.track.ramps[i];
          if (previousS < ramp && r.s >= ramp && !r.jumpedRamps.includes(i)) {
            r.jumpedRamps.push(i);
            this.jump(r, 7.2);
          }
        }
        const branch = this.track.shortcut;
        if (previousS <= branch.start && r.s >= branch.start && r.state === 'Airborne' && r.u > 1.5) {
          r.s -= branch.start;
          r.route = 'shortcut';
          route = branch;
          r.shortcutUsed = true;
          this.events.push({ type: 'shortcut', id: r.id });
        }
      } else if (r.s >= route.length) {
        r.s = this.track.shortcut.end + (r.s - route.length);
        r.route = 'main';
        r.shortcutCompleted = true;
        route = this.track.main;
      }
      const surface = route.surface(r.s, r.u);
      const previousY = r.position.y;
      r.position.x = surface.x;
      r.position.z = surface.z;
      const hit = this.height(r.route, r.s, surface);
      if (r.state === 'Sliding') {
        if (Math.abs(r.u) > EDGE) { this.fall(r); continue; }
        if (hit === null) r.miss += dt; else r.miss = 0;
        if (r.miss > 0.1) { this.fall(r); continue; }
        r.position.y = hit ?? surface.y;
      } else if (r.state === 'Airborne') {
        r.airTime += dt;
        r.vy -= GRAVITY * dt;
        r.position.y = previousY + r.vy * dt;
        if (r.vy < 0 && hit !== null && Math.abs(r.u) <= EDGE && r.position.y <= hit + 0.10 && previousY >= hit - 1.5) {
          r.position.y = hit;
          r.state = 'Sliding'; r.vy = 0; r.miss = 0; r.failedJump = false;
          this.events.push({ type: 'land', id: r.id, position: r.position.clone() });
        } else if (r.position.y < surface.y - 4 || r.airTime > 2.8) this.fall(r);
      }
      if (r.route === 'main' && r.s >= this.track.length - 2 && r.state !== 'Falling' && Math.abs(r.u) <= EDGE) {
        r.s = this.track.length;
        r.state = 'Finished';
        r.finishTime = this.time;
        r.speed = 0;
        r.position.copy(this.track.main.surface(this.track.length, r.u));
        this.events.push({ type: 'finish', id: r.id, place: this.placement(r), time: r.finishTime });
      }
    }
  }
}
