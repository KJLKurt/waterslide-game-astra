import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTrack, buildTrackMeshes, EDGE } from '../src/track.js';
import { Race } from '../src/race.js';

const track=createTrack();const scene=new THREE.Scene();const surface=buildTrackMeshes(track,scene);
const height=(route,s,p)=>surface.height(route,s,p);
const rng=seed=>()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
function create(practice=false,seed=17){const race=new Race(track,height,rng(seed));race.reset(practice);return race;}
function step(race,seconds,input){for(let i=0;i<Math.round(seconds*60);i++)race.update(1/60,typeof input==='function'?input(race):input);}

test('track frames are orthonormal and slide raycasts match sampled surfaces',()=>{
  for(let s=2;s<track.length-2;s+=11){
    const frame=track.main.sample(s);assert.ok(Math.abs(frame.tangent.dot(frame.right))<.002);
    for(const u of [-4,0,4]){const p=track.main.surface(s,u);const hit=height('main',s,p);assert.notEqual(hit,null);assert.ok(Math.abs(hit-p.y)<.22,`surface mismatch at ${s}, ${u}`);}
  }
  assert.equal(height('shortcut',14,track.shortcut.surface(14,0)),null,'real gap must not raycast a surface');
  assert.ok(track.shortcut.length<track.shortcut.end-track.shortcut.start);
});
test('complete race traverses both ramps, lands, finishes and ranks by arrival',()=>{
  const race=create();step(race,36);assert.equal(race.player.state,'Finished');assert.deepEqual(race.player.jumpedRamps,[0,1]);assert.equal(track.progress(race.player),1);assert.ok(race.player.finishTime>20&&race.player.finishTime<35);
  const times=race.order().filter(r=>r.finishTime!==null).map(r=>r.finishTime);assert.deepEqual(times,[...times].sort((a,b)=>a-b));
});
test('holding the edge causes genuine race elimination and never finishes',()=>{
  const race=create();step(race,7,{steer:1,jump:false});assert.equal(race.player.eliminated,true);assert.equal(race.player.state,'Falling');assert.equal(race.player.finishTime,null);
});
test('practice fall respawns at the last checkpoint and can finish',()=>{
  const race=create(true);step(race,12);const checkpoint=race.player.checkpoint;assert.ok(checkpoint>12);
  step(race,.9,{steer:1,jump:false});step(race,2);assert.equal(race.player.eliminated,false);assert.equal(race.player.respawns,1);assert.ok(race.player.s>=checkpoint);assert.equal(race.player.route,'main');
  step(race,30);assert.equal(race.player.state,'Finished');
});
test('manual jump has limited air steering and lands back on the surface',()=>{
  const race=create();step(race,4);assert.equal(race.jump(race.player),true);const startU=race.player.u;
  step(race,.2,{steer:1,jump:false});assert.equal(race.player.state,'Airborne');assert.ok(race.player.u-startU<.7);assert.equal(race.jump(race.player),false);
  step(race,2);assert.equal(race.player.state,'Sliding');assert.ok(Math.abs(race.player.u)<EDGE);
});
test('shortcut requires a right-lane jump, crosses a real gap, maps progress, and reconnects',()=>{
  const race=create();step(race,3.1);const p=race.player;let jumped=false,lastProgress=0,sawBranch=false,sawAirGap=false;
  for(let i=0;i<1400;i++){
    const inZone=p.route==='main'&&p.s>track.shortcut.start-24&&p.s<track.shortcut.start;
    const steer=inZone?THREE.MathUtils.clamp((2.7-p.u)*2,-1,1):THREE.MathUtils.clamp(-p.u*.8,-1,1);
    const jump=!jumped&&p.route==='main'&&p.s>track.shortcut.start-5;
    if(jump)jumped=true;
    race.update(1/60,{steer,jump});
    if(p.route==='shortcut'){sawBranch=true;if(p.s>8&&p.s<21&&p.state==='Airborne')sawAirGap=true;}
    const progress=track.progress(p);assert.ok(progress>=lastProgress-0.001);lastProgress=progress;
    assert.equal(p.eliminated,false);
  }
  assert.ok(sawBranch);assert.ok(sawAirGap);assert.equal(p.route,'main');assert.ok(p.s>track.shortcut.end);assert.ok(p.shortcutUsed);assert.ok(p.shortcutCompleted);
});
test('practice checkpoints allow a previously crossed ramp to launch again',()=>{
  const race=create(true);step(race,24);assert.ok(race.player.jumpedRamps.includes(1));
  // Recreate a fall after the second launch but before the next checkpoint.
  race.player.checkpoint=track.checkpoints[2];race.fall(race.player);step(race,1.5);
  assert.equal(race.player.respawns,1);race.events.length=0;let launchedAgain=false;
  for(let i=0;i<600;i++){race.update(1/60);if(race.events.some(e=>e.type==='jump'&&e.id===0))launchedAgain=true;race.events=[];}
  assert.ok(launchedAgain);assert.equal(race.player.eliminated,false);
});
test('pause freezes countdown and racing; progress ties use speed',()=>{
  const race=create();const count=race.countdown;race.mode='paused';step(race,2);assert.equal(race.countdown,count);race.mode='racing';step(race,1);race.mode='paused';const s=race.player.s,time=race.time;step(race,1);assert.equal(race.time,time);assert.equal(race.player.s,s);
  race.racers.forEach(r=>{r.s=100;r.route='main';r.speed=r.id;});assert.equal(race.order()[0].id,12);
});
test('seeded NPC personalities produce both shortcut successes and real failures',()=>{
  let successes=0,failures=0;const places=new Set();
  for(let seed=1;seed<=12;seed++){
    const race=create(false,seed*7919);step(race,36);places.add(race.placement());
    successes+=race.racers.filter(r=>r.id&&r.shortcutUsed&&r.state==='Finished').length;
    failures+=race.racers.filter(r=>r.id&&r.shortcutUsed&&r.eliminated).length;
  }
  assert.ok(successes>0);assert.ok(failures>0);assert.ok(places.size>1,'the winner must not be predetermined');
});
