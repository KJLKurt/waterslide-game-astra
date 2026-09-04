import { PALETTES, formatTime } from './storage.js';
export const icons = {
  wave: '<path d="M3 14c4-8 8 8 12 0s8 8 12 0M3 7c4-8 8 8 12 0s8 8 12 0"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  sound: '<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 6 6m0-6-6 6"/>',
  settings: '<path d="m10 3-1 3-3 1-3 3 2 3-1 3 3 3 3-1 3 2 3-2 3-1v-4l2-2-2-3-3-1-1-3-3-1Z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  jump: '<path d="M12 20V4m-7 7 7-7 7 7"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 1v6m-4 2h8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 ${name==='wave'?'30 24':'24 24'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

export function buildUI(profile,track) {
  const points=track.main.samples.filter((_,i)=>i%7===0).map(p=>[p.position.x,p.position.z]);
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
  const map=(x,z)=>[18+(x-minX)/(maxX-minX)*100,14+(z-minZ)/(maxZ-minZ)*134];
  const path=points.map(([x,z])=>map(x,z).join(',')).join(' ');
  const mapSVG=`<svg class="course-map" viewBox="0 0 136 166" aria-label="Sunset Sprint winding course map"><polyline points="${path}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${map(...points[0])[0]}" cy="${map(...points[0])[1]}" r="5" fill="#173c44"/><circle class="map-player" r="4" fill="#173c44" stroke="#fff" stroke-width="2"/></svg>`;
  document.querySelector('#app').innerHTML=`
  <canvas id="game" aria-label="3D waterslide racing course"></canvas>
  <div id="menu-shade"></div>
  <header id="menu-header"><a class="brand" href="./" aria-label="Splashline home"><span class="brand-mark">${icon('wave')}</span>splashline<span class="brand-dot">®</span></a><div class="header-right"><span class="edition">THE ENDLESS SUMMER CLUB</span><button id="install" class="icon-button" aria-label="Install game" hidden>${icon('download')}</button><button id="sound" class="icon-button" aria-label="Toggle sound">${icon('sound')}</button><button id="settings-open" class="icon-button" aria-label="Open settings">${icon('settings')}</button></div></header>
  <main id="menu">
    <div class="menu-content"><div class="eyebrow"><span class="tiny-sun">✳</span> GOOD TIMES. HIGH TIDES.</div>
    <h1>Catch the<br><span>current.</span></h1>
    <p class="intro">A little sun. A lot of speed.<br> 13 racers. One way to make a splash.</p>
    <section class="launch-card" aria-label="Race setup">
      <div class="swimmer-row"><div><span class="field-label">YOUR SWIMMER</span><strong id="palette-name">${PALETTES[profile.palette].name}</strong></div><div class="palettes" role="group" aria-label="Swimmer palette">${PALETTES.map((p,i)=>`<button class="swatch ${i===profile.palette?'selected':''}" data-palette="${i}" style="--swatch:${p.color}" aria-label="${p.name} palette" aria-pressed="${i===profile.palette}">${i===profile.palette?icon('check'):''}</button>`).join('')}</div></div>
      <div class="accessories" role="group" aria-label="Swimmer accessory"><button data-accessory="goggles">Goggles</button><button data-accessory="cap">Sun cap</button><button data-accessory="classic">Classic</button><button data-accessory="crown" title="Win a race to unlock">Crown <span>♔</span></button></div>
      <button id="start-btn" class="primary-button">Let's slide <span>${icon('arrow')}</span></button>
      <div class="practice-row"><label class="switch-label" for="practice"><span class="switch"><input type="checkbox" id="practice" ${profile.settings.practice?'checked':''}><span></span></span>Practice mode</label><span class="practice-note" id="practice-note">One life. Make it count.</span></div>
    </section>
    <div class="control-hint"><span><kbd>←</kbd><kbd>→</kbd> steer</span><span><kbd>SPACE</kbd> jump</span><span class="touch-hint">Thumbstick to steer · tap to jump</span></div>
    </div>
    <aside class="course-card"><div class="course-top"><span class="field-label">THE COURSE</span><span class="course-number">01 / 01</span></div><div class="course-card-body"><div><h2>Sunset<br>Sprint</h2><span class="course-tag"><span></span> TROPICAL CIRCUIT</span></div>${mapSVG}</div><div class="course-stats"><div><strong>${Math.round(track.length)}<small>m</small></strong><span>SLIDE LENGTH</span></div><div><strong>13</strong><span>RACERS</span></div><div><strong>2</strong><span>RAMPS</span></div></div></aside>
    <div class="preview-label"><span></span> LIVE COURSE PREVIEW <span class="preview-arrow">↘</span></div>
  </main>
  <footer id="menu-footer"><span class="offline-state"><span id="offline-dot"></span><span id="offline-text">YOUR NEXT MINI VACATION</span></span><span id="best-record">${icon('trophy')} PERSONAL BEST <strong>${formatTime(profile.best[profile.settings.practice?'practice':'race'])}</strong></span><span class="footer-note">NO DOWNLOAD. JUST DIVE IN.</span></footer>
  <div id="hud" hidden><div class="race-top"><div class="position-box"><span class="field-label">POSITION</span><div><strong id="place">7</strong><span>/ 13</span></div></div><div class="timing"><span id="mode-label">SUNSET SPRINT</span><strong id="time">00:00.00</strong><div class="progress-track"><span id="progress-bar"></span></div><small><span id="progress">0</span>% TO THE SPLASH</small></div><button id="pause" class="icon-button" aria-label="Pause race">${icon('pause')}</button></div><div class="speed-box"><strong id="speed">0</strong><span>KM/H</span></div><aside id="mini-board"></aside><div id="race-map">${mapSVG}</div><div id="race-toast" role="status"></div><div id="countdown" aria-live="assertive"></div><div id="touch-controls"><div class="joystick-wrap"><div id="joystick" aria-label="Steering joystick" role="group"><span class="stick-cross horizontal"></span><span class="stick-cross vertical"></span><span class="stick-knob"></span></div><span class="control-caption">STEER</span></div><div class="jump-wrap"><button id="jump" aria-label="Jump">${icon('jump')}<span>JUMP</span></button><span class="control-caption" id="jump-status">SPACE</span></div></div></div>
  <div id="modal-backdrop" hidden><section id="settings-dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden><div class="dialog-heading"><div><span class="field-label" id="settings-eyebrow">MAKE YOURSELF COMFORTABLE</span><h2 id="settings-title">Your kind of flow.</h2></div><button id="settings-close" class="icon-button" aria-label="Close settings">${icon('close')}</button></div>
    <div class="settings-group"><h3>Controls</h3><label class="setting-row"><span>Steering sensitivity</span><span class="range-control"><input id="sensitivity" type="range" min="0.5" max="1.7" step="0.1" value="${profile.settings.sensitivity}"><output id="sensitivity-value">${profile.settings.sensitivity.toFixed(1)}×</output></span></label><label class="setting-row"><span>Thumbstick side</span><select id="handedness"><option value="right">Left side (default)</option><option value="left">Right side (swapped)</option></select></label></div>
    <div class="settings-group"><h3>Graphics</h3><label class="setting-row"><span>Quality<small id="quality-note">Auto adapts to your device</small></span><select id="graphics"><option value="auto">Adaptive</option><option value="high">High · 1.5×</option><option value="low">Low · 1.0×</option></select></label>${toggle('shadows','Soft shadows','More depth, more battery')}${toggle('postprocessing','Color finish','Subtle grading and vignette')}${toggle('effects','Splashes & trails','A little extra sparkle')}</div>
    <div class="settings-group"><h3>Audio</h3>${toggle('sound-setting','Sound effects','Countdown, jumps and splashes')}${toggle('music','Poolside melody','Original, gently generated tones')}</div>
    <div class="settings-group"><h3>Your progress <span id="unlock-count"></span></h3><div id="unlocks" class="unlock-list"></div><p class="local-note">Saved on this device. Your race stays yours.</p></div>
    <button id="settings-done" class="primary-button">Back to the sunshine ${icon('arrow')}</button><button id="quit" class="text-button" hidden>Leave race</button>
  </section>
  <section id="result-dialog" class="dialog result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title" hidden><div class="result-icon" id="result-icon">${icon('trophy')}</div><span class="eyebrow" id="result-eyebrow">THAT'S A WRAP</span><h2 id="result-title">What a splash.</h2><p id="result-description"></p><div class="result-stats"><div><span>POSITION</span><strong id="result-position"></strong></div><div><span>YOUR TIME</span><strong id="result-time"></strong></div></div><div id="result-badge"></div><div class="board-title"><span>THE FINISH LINE</span><span>TIME / STATUS</span></div><ol id="result-board"></ol><button id="replay" class="primary-button">One more slide ${icon('arrow')}</button><button id="result-menu" class="text-button">Back to the poolside</button></section></div>
  <div id="fatal-error" hidden role="alert"></div><div id="save-notice" hidden role="status">Storage is unavailable. You can play, but progress won’t save.</div>
  `;
  return { map };
}
function toggle(id,label,description){return `<label class="setting-row"><span>${label}<small>${description}</small></span><span class="switch"><input id="${id}" type="checkbox"><span></span></span></label>`;}
