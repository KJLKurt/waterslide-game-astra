import './style.css';
import { createTrack } from './track.js';
import { Race } from './race.js';
import { World } from './world.js';
import { Controls } from './input.js';
import { GameAudio } from './audio.js';
import { loadProfile, saveProfile, PALETTES, formatTime } from './storage.js';
import { buildUI, icon } from './ui.js';

const profile = loadProfile();
const track = createTrack();
const ui = buildUI(profile, track);
const $ = id => document.getElementById(id);
let world, race, controls;
let screen = 'menu', previousMode = 'menu', time = 0, accumulator = 0, toastUntil = 0, lastHUD = -1;
let result = null, deferredInstall = null, focusBeforeDialog = null;
const audio = new GameAudio(profile.settings);
try {
  world = new World($('game'), track, profile.settings);
  race = new Race(track, (route, s, position) => world.surface.height(route, s, position));
} catch (error) {
  $('fatal-error').hidden = false;
  $('fatal-error').textContent = 'The pool couldn’t open. This game needs WebGL 2. Try updating your browser and enabling hardware acceleration, then reload.';
  console.error(error);
  throw error;
}

function persist() { if (!saveProfile(profile)) $('save-notice').hidden = false; }
function customize() {
  if(profile.accessory==='crown'&&!profile.unlocks.includes('champion'))profile.accessory='goggles';
  world.swimmers.customize(0, profile.palette, profile.accessory);
  $('palette-name').textContent = PALETTES[profile.palette].name;
  document.querySelectorAll('[data-palette]').forEach(el => {
    const selected = +el.dataset.palette === profile.palette; el.classList.toggle('selected',selected); el.setAttribute('aria-pressed',selected); el.innerHTML=selected?icon('check'):'';
  });
  document.querySelectorAll('[data-accessory]').forEach(el => {
    el.classList.toggle('selected',el.dataset.accessory===profile.accessory); el.setAttribute('aria-pressed',el.dataset.accessory===profile.accessory);
    el.disabled=el.dataset.accessory==='crown'&&!profile.unlocks.includes('champion');
  });
}
function updateMenu() {
  $('practice-note').textContent=profile.settings.practice?'Fall. Respawn. Find your flow.':'One life. Make it count.';
  $('start-btn').innerHTML=`${profile.settings.practice?'Find your flow':"Let's slide"} <span>${icon('arrow')}</span>`;
  $('best-record').innerHTML=`${icon('trophy')} ${profile.settings.practice?'PRACTICE':'PERSONAL'} BEST <strong>${formatTime(profile.best[profile.settings.practice?'practice':'race'])}</strong>`;
  $('sound').innerHTML=icon(profile.settings.sound?'sound':'muted');
  $('sound').setAttribute('aria-pressed',profile.settings.sound);
  document.body.classList.toggle('left-handed',profile.settings.handedness==='left');
  customize();
}
function showMenu() {
  screen='menu';race.reset(profile.settings.practice);race.mode='menu';controls?.clear();if(controls)controls.active=false;
  for (const r of race.racers) { r.s=92+r.id*4.1;r.u=Math.sin(r.id*3)*2.5;r.position.copy(track.main.surface(r.s,r.u)); }
  race.player.s=114;race.player.u=-1.2;race.player.position.copy(track.main.surface(114,-1.2));
  for(const id of ['menu','menu-header','menu-footer','menu-shade'])$(id).hidden=false;
  for(const id of ['hud','modal-backdrop','settings-dialog','result-dialog'])$(id).hidden=true;
  $('menu').inert=false;$('menu-header').inert=false;
  world.cameraReady=false;result=null;updateMenu();
}
function startRace() {
  audio.unlock();audio.play('click');screen='game';race.reset(profile.settings.practice);result=null;
  for(const id of ['menu','menu-header','menu-footer','menu-shade','modal-backdrop','settings-dialog','result-dialog'])$(id).hidden=true;
  $('hud').hidden=false;$('hud').inert=false;controls.clear();controls.active=true;world.cameraReady=false;
  $('mode-label').textContent=profile.settings.practice?'PRACTICE · CHECKPOINTS ON':'SUNSET SPRINT';
  toastUntil=0;$('race-toast').classList.remove('visible');lastHUD=-1;refreshHUD();
  $('pause').focus({preventScroll:true});
}
function settingsOpen() {
  if(screen==='settings')return;
  focusBeforeDialog=document.activeElement;
  previousMode=race.mode;
  if(screen==='game'){race.mode='paused';$('settings-eyebrow').textContent='TAKE A BREATHER';$('settings-title').textContent='Poolside pause.';}
  else {$('settings-eyebrow').textContent='MAKE YOURSELF COMFORTABLE';$('settings-title').textContent='Your kind of flow.';}
  screen='settings';controls.clear();controls.active=false;
  $('hud').inert=true;$('menu').inert=true;$('menu-header').inert=true;
  $('quit').hidden=previousMode==='menu';
  $('settings-done').innerHTML=`${previousMode==='menu'?'Back to the sunshine':'Keep sliding'} ${icon('arrow')}`;
  for(const key of ['graphics','handedness','sensitivity'])$(key).value=profile.settings[key];
  for(const key of ['shadows','postprocessing','effects','music'])$(key).checked=profile.settings[key];
  $('sound-setting').checked=profile.settings.sound;
  $('sensitivity-value').textContent=profile.settings.sensitivity.toFixed(1)+'×';
  const unlocks=[['first-splash','First finish'],['shortcut','Gap jumper'],['champion','Champion ♔']];
  $('unlocks').innerHTML=unlocks.map(([id,name])=>`<span class="unlock ${profile.unlocks.includes(id)?'earned':''}">${profile.unlocks.includes(id)?'✓':'○'} ${name}</span>`).join('');
  $('unlock-count').textContent=`${profile.unlocks.length} / 3`;
  $('modal-backdrop').hidden=false;$('settings-dialog').hidden=false;$('result-dialog').hidden=true;
  $('settings-close').focus({preventScroll:true});
}
function settingsClose() {
  if(screen!=='settings')return;
  $('modal-backdrop').hidden=true;$('settings-dialog').hidden=true;
  $('hud').inert=false;$('menu').inert=false;$('menu-header').inert=false;
  race.mode=previousMode;screen=previousMode==='menu'?'menu':'game';controls.active=screen==='game';controls.clear();
  focusBeforeDialog?.focus({preventScroll:true});
}
function pauseToggle(){if(screen==='settings')settingsClose();else if(screen==='game')settingsOpen();}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});}
controls=new Controls($('joystick'),$('jump'),{pause:pauseToggle,fullscreen});
$('start-btn').onclick=startRace;$('replay').onclick=startRace;$('result-menu').onclick=showMenu;
$('settings-open').onclick=settingsOpen;$('settings-close').onclick=settingsClose;$('settings-done').onclick=settingsClose;$('quit').onclick=showMenu;$('pause').onclick=settingsOpen;
$('practice').onchange=e=>{profile.settings.practice=e.target.checked;persist();updateMenu();};
$('sound').onclick=()=>{audio.unlock();profile.settings.sound=!profile.settings.sound;persist();updateMenu();audio.play('click');};
document.querySelectorAll('[data-palette]').forEach(el=>el.onclick=()=>{profile.palette=+el.dataset.palette;persist();customize();});
document.querySelectorAll('[data-accessory]').forEach(el=>el.onclick=()=>{profile.accessory=el.dataset.accessory;persist();customize();});
for(const id of ['graphics','handedness','sensitivity','shadows','postprocessing','effects','sound-setting','music']) {
  $(id).addEventListener(id==='sensitivity'?'input':'change',e=>{
    const key=id==='sound-setting'?'sound':id;
    profile.settings[key]=e.target.type==='checkbox'?e.target.checked:id==='sensitivity'?+e.target.value:e.target.value;
    if(['graphics','shadows','postprocessing','effects'].includes(id))world.applySettings(profile.settings);
    $('sensitivity-value').textContent=profile.settings.sensitivity.toFixed(1)+'×';audio.unlock();persist();updateMenu();
  });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game')settingsOpen();});
window.addEventListener('blur',()=>{if(screen==='game')settingsOpen();});
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||!['settings','results'].includes(screen))return;
  const dialog=$(screen==='settings'?'settings-dialog':'result-dialog');
  const focusables=[...dialog.querySelectorAll('button:not([disabled]),input,select')].filter(el=>!el.hidden);
  const first=focusables[0],last=focusables.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});

function toast(message,duration=2.3){$('race-toast').textContent=message;$('race-toast').classList.add('visible');toastUntil=time+duration;}
function unlock(id){if(!profile.unlocks.includes(id)){profile.unlocks.push(id);return true;}return false;}
function finishResult(event) {
  if(result)return;
  const finished=event.type==='finish';
  result={finished,place:race.placement(),time:race.player.finishTime??race.time,newBest:false};
  if(finished){
    const mode=race.practice?'practice':'race';
    if(!profile.best[mode]||result.time<profile.best[mode]){profile.best[mode]=result.time;result.newBest=true;}
    unlock('first-splash');
    if(race.player.shortcutCompleted)unlock('shortcut');
    if(result.place===1&&!race.practice)unlock('champion');
    persist();
  }
  screen='results';controls.active=false;controls.clear();$('hud').inert=true;
  $('result-icon').innerHTML=icon(finished?'trophy':'wave');
  $('result-eyebrow').textContent=finished?(race.practice?'PRACTICE MAKES A SPLASH':'SUNSET SPRINT · FINISHED'):'OFF THE EDGE';
  $('result-title').textContent=finished?(result.place===1?'Hello, champion.':'What a splash.'):'A little too wild.';
  $('result-description').textContent=finished?(race.practice?`You found your flow. ${race.player.respawns} checkpoint respawn${race.player.respawns===1?'':'s'}.`:'Sun on your face. A finish worth chasing.'): 'The current got away. Try again, or practice with checkpoints.';
  $('result-position').innerHTML=finished?`${result.place}<small> / 13</small>`:'DNF';
  $('result-time').textContent=formatTime(result.time);
  $('result-badge').textContent=result.newBest?'✧ A fresh personal best!':finished&&result.place===1&&!race.practice?'♔ Champion crown unlocked':finished?'Every slide is a good time.':'Steer gently. Center your landing.';
  $('modal-backdrop').hidden=false;$('result-dialog').hidden=false;$('settings-dialog').hidden=true;
  updateBoard();$('replay').focus({preventScroll:true});
}
function updateBoard(){
  $('result-board').innerHTML=race.order().map((r,i)=>`<li class="${r.id===0?'you':''}"><span class="rank">${r.eliminated?'–':i+1}</span><span class="racer-color" style="background:${PALETTES[r.id===0?profile.palette:r.id%4].color}"></span><span class="racer-name">${r.name}</span><span class="racer-time">${r.finishTime!==null?formatTime(r.finishTime):r.eliminated?'DNF · fell':r.state==='Falling'?'Falling':Math.round(track.progress(r)*100)+'% · racing'}</span></li>`).join('');
}
function refreshHUD() {
  $('place').textContent=race.placement();$('time').textContent=formatTime(race.player.finishTime??race.time);
  const progress=Math.round(track.progress(race.player)*100);$('progress').textContent=progress;$('progress-bar').style.width=progress+'%';$('speed').textContent=Math.round(race.player.speed*3.6);
  const cooling=race.player.cooldown>0||race.player.state!=='Sliding';$('jump').classList.toggle('cooling',cooling);
  $('jump-status').textContent=race.player.state==='Airborne'?'AIRBORNE':race.player.cooldown>0?'RECHARGING':'SPACE / TAP';
  $('jump').setAttribute('aria-disabled',cooling);
  const ordered=race.order(),playerIndex=ordered.indexOf(race.player);
  const nearby=ordered.slice(Math.max(0,Math.min(playerIndex-1,10)),Math.max(3,Math.min(playerIndex+2,13)));
  $('mini-board').innerHTML=nearby.map(r=>`<div class="mini-racer ${r.id===0?'you':''}"><span>${ordered.indexOf(r)+1}</span><i style="background:${PALETTES[r.id===0?profile.palette:r.id%4].color}"></i><span>${r.name}</span></div>`).join('');
  const [x,z]=ui.map(race.player.position.x,race.player.position.z);
  document.querySelectorAll('.map-player').forEach(el=>{el.setAttribute('cx',x);el.setAttribute('cy',z);});
  if(race.mode==='countdown')$('countdown').innerHTML=`${Math.ceil(race.countdown)}<small>FIND YOUR FLOW</small>`;
  else if(race.time<.7&&race.mode==='racing')$('countdown').innerHTML='GO!';else $('countdown').textContent='';
  if(screen==='results')updateBoard();
}
function tick(dt) {
  time+=dt;
  const input=controls.read();race.update(dt,input,profile.settings.sensitivity);
  for(const event of race.events){
    if(event.id===0||event.type==='count'||event.type==='go')audio.play(event.type);
    if(event.position&&['land','fall'].includes(event.type))world.splash(event.position,event.id===0?22:8);
    if(event.id===0){
      if(event.type==='shortcut')toast('SHORTCUT! Clear the gap ↗');
      if(event.type==='respawn')toast('Back in the flow · checkpoint respawn');
      if(event.type==='fall')toast(race.practice?'Splash! Returning to your checkpoint…':'Over the edge…');
      if(event.type==='finish'||event.type==='eliminated')finishResult(event);
    }
    if(event.type==='go')toast('Stay centered for extra speed',2.4);
  }
  race.events.length=0;
  if(screen==='game'&&race.mode==='racing'&&race.player.route==='main'&&race.player.s>track.shortcut.start-25&&race.player.s<track.shortcut.start-6&&time>toastUntil)toast('SHORTCUT AHEAD · steer right + jump',2.1);
  if(time>toastUntil)$('race-toast').classList.remove('visible');
  if(time-lastHUD>.09&&screen!=='menu'){refreshHUD();lastHUD=time;}
  audio.update(dt,screen==='game'&&race.mode==='racing');
}
let last=performance.now(),slowFrames=0,qualityFrames=0,qualityTotal=0,manual=false;
function frame(now){
  requestAnimationFrame(frame);
  if(manual)return;
  const elapsed=Math.min((now-last)/1000,.1);last=now;accumulator+=elapsed;
  while(accumulator>=1/60){tick(1/60);accumulator-=1/60;}
  world.update(race,time,elapsed,screen==='menu'||screen==='settings'&&previousMode==='menu');world.render();
  if(profile.settings.graphics==='auto'&&screen==='game'&&race.mode==='racing'&&!document.hidden){
    qualityTotal+=elapsed;qualityFrames++;
    if(qualityTotal>3){if(qualityFrames/qualityTotal<43)slowFrames++;else slowFrames=0;if(slowFrames>=2&&!world.adaptiveLow){world.adaptiveLow=true;world.resize();$('quality-note').textContent='Auto lowered resolution for smoother racing';}qualityTotal=0;qualityFrames=0;}
  }
}
showMenu();requestAnimationFrame(frame);
window.render_game_to_text=()=>JSON.stringify({
  screen,mode:race.mode,practice:race.practice,time:+race.time.toFixed(2),countdown:+race.countdown.toFixed(2),
  coordinates:'Y up; s meters along route; u lateral meters (positive right); main course advances toward negative Z',
  player:{s:+race.player.s.toFixed(2),u:+race.player.u.toFixed(2),speed:+race.player.speed.toFixed(2),vy:+race.player.vy.toFixed(2),position:race.player.position.toArray().map(v=>+v.toFixed(2)),state:race.player.state,route:race.player.route,progress:+track.progress(race.player).toFixed(4),place:race.placement(),cooldown:+race.player.cooldown.toFixed(2),checkpoint:+race.player.checkpoint.toFixed(2),respawns:race.player.respawns,eliminated:race.player.eliminated,shortcutUsed:race.player.shortcutUsed},
  course:{length:+track.length.toFixed(1),ramps:track.ramps.map(v=>+v.toFixed(1)),shortcut:{entry:+track.shortcut.start.toFixed(1),exit:+track.shortcut.end.toFixed(1),length:+track.shortcut.length.toFixed(1),gap:track.shortcut.gap,entryRule:'Jump in the right lane (u > 1.5) at the entry'},checkpoints:track.checkpoints.map(v=>+v.toFixed(1))},
  leaderboard:race.order().map(r=>({name:r.name,progress:+track.progress(r).toFixed(3),state:r.state,route:r.route,eliminated:r.eliminated,finishTime:r.finishTime})),
  controls:{steer:controls.steer,stickPointer:controls.stickId,jumpPointer:controls.jumpId,handedness:profile.settings.handedness},
  graphics:{quality:profile.settings.graphics,adaptiveLow:world.adaptiveLow,pixelRatio:world.renderer.getPixelRatio(),drawCalls:world.renderer.info.render.calls},result,
});
window.advanceTime=ms=>{
  manual=true;const steps=Math.max(1,Math.round(ms/(1000/60)));for(let i=0;i<steps;i++){tick(1/60);world.update(race,time,1/60,screen==='menu'||screen==='settings'&&previousMode==='menu');}
  refreshHUD();world.render();last=performance.now();manual=false;
};
// Read-only inspection is useful when profiling real devices.
window.splashline={track,race,profile,world,startRace,showMenu};

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;$('install').hidden=false;});
$('install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('install').hidden=true;}};
window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
if('serviceWorker'in navigator&&import.meta.env.PROD){
  const root=new URL(import.meta.env.BASE_URL,location.href);
  navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname}).then(()=>navigator.serviceWorker.ready).then(()=>{
    $('offline-text').textContent='OFFLINE READY. SLIDE ANYWHERE.';
  }).catch(error=>{console.warn('Offline setup unavailable:',error);$('offline-text').textContent='ONLINE · OFFLINE SETUP UNAVAILABLE';});
}
