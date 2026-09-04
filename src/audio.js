export class GameAudio {
  constructor(settings){this.settings=settings;this.context=null;this.noteTime=0;this.note=0;}
  unlock(){
    if(!this.context){const AudioContext=window.AudioContext||window.webkitAudioContext;if(AudioContext)this.context=new AudioContext();}
    this.context?.resume().catch(()=>{});
  }
  tone(frequency,duration=.13,type='sine',volume=.06){
    const ctx=this.context;if(!ctx||ctx.state!=='running')return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=type;oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+duration);
  }
  play(type){
    if(!this.settings.sound)return;
    const sounds={count:[440,.10],go:[880,.35],jump:[620,.16],land:[160,.08],fall:[110,.4],finish:[1046,.7],respawn:[520,.25],shortcut:[784,.2],click:[390,.05]};
    const sound=sounds[type];if(sound)this.tone(...sound);
  }
  update(dt,playing){
    if(!playing||!this.settings.music)return;
    this.noteTime-=dt;if(this.noteTime<=0){this.noteTime=.32;const notes=[261.63,329.63,392,523.25,440,392,329.63,293.66];this.tone(notes[this.note++%notes.length],.24,'sine',.021);}
  }
}
