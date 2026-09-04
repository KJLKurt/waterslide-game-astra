export class Controls {
  constructor(joystick, jumpButton, { pause, fullscreen }) {
    this.keys = new Set(); this.steer = 0; this.jumpQueued = false; this.stickId = null; this.jumpId = null; this.active = false;
    this.joystick = joystick; this.knob = joystick.querySelector('.stick-knob'); this.jumpButton = jumpButton;
    this.move = event => {
      if (event.pointerId !== this.stickId) return;
      const rect = joystick.getBoundingClientRect();
      const radius = rect.width * .32;
      let x = event.clientX - (rect.left + rect.width / 2), y = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(x,y); if(distance>radius){x*=radius/distance;y*=radius/distance;}
      this.steer = Math.abs(x/radius)<.08?0:x/radius;
      this.knob.style.transform = `translate(${x}px,${y}px)`;
      event.preventDefault();
    };
    joystick.addEventListener('pointerdown', e => {
      if(!this.active||this.stickId!==null)return;
      this.stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);joystick.classList.add('active');this.move(e);
    });
    joystick.addEventListener('pointermove', this.move);
    const releaseStick=e=>{if(e.pointerId===this.stickId){this.stickId=null;this.steer=0;this.knob.style.transform='';joystick.classList.remove('active');}};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,releaseStick);
    jumpButton.addEventListener('pointerdown',e=>{if(!this.active||this.jumpId!==null)return;this.jumpId=e.pointerId;jumpButton.setPointerCapture(e.pointerId);this.jumpQueued=true;jumpButton.classList.add('pressed');e.preventDefault();});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])jumpButton.addEventListener(type,e=>{if(e.pointerId===this.jumpId){this.jumpId=null;jumpButton.classList.remove('pressed');}});
    // Assistive activation has no pointerdown. Native keyboard Space is handled globally.
    jumpButton.addEventListener('click',e=>{if(e.detail===0&&this.active)this.jumpQueued=true;});
    document.addEventListener('keydown',e=>{
      if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      if(['ArrowLeft','ArrowRight','KeyA','KeyD','Space'].includes(e.code)&&this.active){e.preventDefault();this.keys.add(e.code);if(e.code==='Space'&&!e.repeat)this.jumpQueued=true;}
      if(['Escape','KeyP'].includes(e.code)&&!e.repeat)pause();
      if(e.code==='KeyF'&&!e.repeat)fullscreen();
    });
    document.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>this.clear());
    for(const name of ['gesturestart','gesturechange','gestureend'])document.addEventListener(name,e=>{if(this.active)e.preventDefault();},{passive:false});
    document.addEventListener('touchmove',e=>{if(this.active&&!e.target.closest('.dialog'))e.preventDefault();},{passive:false});
  }
  read() {
    const keyboard=(this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0);
    const input={steer:this.active?(keyboard||this.steer):0,jump:this.active&&this.jumpQueued};this.jumpQueued=false;return input;
  }
  clear(){this.keys.clear();this.steer=0;this.jumpQueued=false;this.stickId=null;this.jumpId=null;this.knob.style.transform='';this.joystick.classList.remove('active');this.jumpButton.classList.remove('pressed');}
}
