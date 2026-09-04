import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Swimmers } from './characters.js';
import { buildTrackMeshes } from './track.js';

const dummy = new THREE.Object3D();
const v = new THREE.Vector3();
function batch(scene, geometry, items, material) {
  const mesh = new THREE.InstancedMesh(geometry, material || new THREE.MeshStandardMaterial({ roughness: 0.8 }), items.length);
  items.forEach((item, i) => {
    dummy.position.set(...item.p); dummy.scale.set(...(item.s || [1,1,1])); dummy.rotation.set(...(item.r || [0,0,0])); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, new THREE.Color(item.c || '#ffffff'));
  });
  mesh.castShadow = true; scene.add(mesh); return mesh;
}
function label(text, background = '#173c44', foreground = '#ffffff') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(0,0,512,128,24); ctx.fill();
  ctx.font = 'bold 43px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = foreground; ctx.fillText(text,256,64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }));
}
export class World {
  constructor(canvas, track, settings) {
    this.track = track; this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor('#c1f0ed');
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#b6e7e3', 180, 570);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1400);
    this.cameraPosition = new THREE.Vector3(); this.cameraTarget = new THREE.Vector3(); this.cameraReady = false;
    this.scene.add(new THREE.HemisphereLight('#fff9df', '#55999b', 2.1));
    this.sun = new THREE.DirectionalLight('#fff1d4', 2.2); this.sun.position.set(80,170,40);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 20, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 world; void main(){world=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 world; void main(){float t=smoothstep(-50.,550.,world.y); gl_FragColor=vec4(mix(vec3(.78,.94,.90),vec3(.40,.77,.83),t),1.);}',
    })); this.scene.add(sky);
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: 'varying vec2 p; void main(){p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float time; varying vec2 p; void main(){float wave=sin(p.x*.10+p.y*.15+time*.5)*sin(p.y*.2-time*.3); float glint=pow(max(0.,wave),16.); vec3 c=mix(vec3(.18,.66,.68),vec3(.38,.81,.78),.5+.5*sin(p.y*.008)); gl_FragColor=vec4(c+glint*.09,1.);}',
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), this.waterMaterial); sea.rotation.x=-Math.PI/2; sea.position.y=-12; this.scene.add(sea);
    this.surface = buildTrackMeshes(track, this.scene);
    this.swimmers = new Swimmers(this.scene);
    this.addScenery(); this.addMarkers(); this.addEffects();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(vec3(l),c.rgb,1.10);c.rgb*=1.-.16*pow(length((vUv-.5)*1.3),2.);gl_FragColor=c;}',
    }));
    this.applySettings(settings); this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  addScenery() {
    const sand = [], grass = [], trunks = [], leaves = [], clouds = [], supports = [];
    let seed=123; const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    for (let i=0;i<23;i++) {
      const p = this.track.main.sample((i / 22) * this.track.length).position;
      const side = i % 2 ? 1 : -1;
      const x=p.x+side*(32+random()*52), z=p.z+(random()-.5)*50;
      const size = 11+random()*16;
      const y = -10 + (i<6 ? 17 + random()*12 : random()*7);
      sand.push({p:[x,y,z],s:[size,5,size*.8],c:'#f1dcc0'});
      grass.push({p:[x,y+2.1,z],s:[size*.81,3,size*.64],c:i%2?'#75ba90':'#8dca9d'});
      for(let j=0;j<3;j++) {
        const px=x+(random()-.5)*size, pz=z+(random()-.5)*size*.7, h=7+random()*5;
        trunks.push({p:[px,y+h/2+3,pz],s:[.4,h,.4],r:[.08,0,.1],c:'#aa8966'});
        for(let k=0;k<5;k++) {
          const angle=k*Math.PI*2/5;
          leaves.push({p:[px+Math.sin(angle)*2.0,y+h+2.8,pz+Math.cos(angle)*2.0],s:[1.25,.26,3.9],r:[.2,angle,.1],c:k%2?'#2b947c':'#48af87'});
        }
      }
    }
    for(let i=0;i<32;i++) {
      const x=(random()-.5)*500, z=80-random()*570, y=85+random()*25;
      for(let j=0;j<3;j++) clouds.push({p:[x+j*5,y+(j%2)*2,z],s:[8,3.0+random()*2,4],c:'#f4ffef'});
    }
    for(let s=20;s<this.track.length;s+=38) {
      const p=this.track.main.sample(s).position; const h=p.y+12;
      supports.push({p:[p.x,p.y-h/2-.25,p.z],s:[.55,h,.55],c:'#e5d8b7'});
    }
    batch(this.scene,new THREE.SphereGeometry(1,9,6),sand);
    batch(this.scene,new THREE.SphereGeometry(1,9,6),grass);
    batch(this.scene,new THREE.CylinderGeometry(.7,1,1,6),trunks);
    batch(this.scene,new THREE.SphereGeometry(1,6,4),leaves);
    batch(this.scene,new THREE.SphereGeometry(1,9,6),clouds,new THREE.MeshLambertMaterial());
    batch(this.scene,new THREE.CylinderGeometry(1,1,1,6),supports);
    const buoys=[];
    for(let i=0;i<18;i++) buoys.push({p:[-95+i*13,-10,52],s:[.6,.6,.6],c:i%2?'#fff1da':'#ff906e'});
    batch(this.scene,new THREE.SphereGeometry(1,8,6),buoys);
  }
  addMarkers() {
    const posts=[], checks=[], arrows=[];
    for(const s of [9,this.track.length-3]) {
      const f=this.track.main.sample(s);
      for(const side of [-1,1]) {
        const p=f.position.clone().addScaledVector(f.right,side*5.8);
        posts.push({p:[p.x,p.y+4,p.z],s:[.35,8,.35],c:'#fff4da'});
      }
      const sign=label(s<10?'SPLASHLINE':'FINISH', s<10?'#173c44':'#d4f575', s<10?'#ffffff':'#173c44');
      sign.position.copy(f.position).add(new THREE.Vector3(0,7.5,0)); sign.rotation.y=Math.atan2(f.tangent.x,f.tangent.z); this.scene.add(sign);
      for(let col=0;col<10;col++) for(let row=0;row<2;row++) {
        const p=this.track.main.surface(s+row*.85, col-4.5).add(new THREE.Vector3(0,.035,0));
        checks.push({p:p.toArray(),s:[1,.045,.85],r:[0,Math.atan2(f.tangent.x,f.tangent.z),f.bank],c:(col+row)%2?'#173c44':'#fffde7'});
      }
    }
    for(const s of this.track.ramps) {
      const f=this.track.main.sample(s);
      for(let row=0;row<4;row++) for(const side of [-1,1]) {
        const p=this.track.main.surface(s-2-row*1.45,side*.8).add(new THREE.Vector3(0,.07,0));
        arrows.push({p:p.toArray(),s:[.45,.08,2.1],r:[0,Math.atan2(f.tangent.x,f.tangent.z)+side*.65,0],c:'#fcf9d1'});
      }
      const sign=label('↑  LAUNCH', '#ff8e70', '#173c44'); sign.scale.setScalar(.58);
      sign.position.copy(this.track.main.surface(s,-6.6)).add(new THREE.Vector3(0,3.3,0));sign.rotation.y=Math.atan2(-f.tangent.x,-f.tangent.z); this.scene.add(sign);
    }
    const s=this.track.shortcut.start-16,f=this.track.main.sample(s);
    const sign=label('JUMP RIGHT  ↗', '#d4f575', '#173c44'); sign.scale.setScalar(.8);
    sign.position.copy(this.track.main.surface(s,5.8)).add(new THREE.Vector3(0,4,0));sign.rotation.y=Math.atan2(-f.tangent.x,-f.tangent.z); this.scene.add(sign);
    batch(this.scene,new THREE.CylinderGeometry(1,1,1,8),posts);
    batch(this.scene,new THREE.BoxGeometry(1,1,1),checks);
    batch(this.scene,new THREE.BoxGeometry(1,1,1),arrows);
    const playerMark=label('YOU', '#173c44', '#d4f575'); playerMark.scale.set(.27,.36,.3);this.scene.add(playerMark);this.playerMark=playerMark;
  }
  addEffects() {
    this.particles=Array.from({length:110},()=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),life:0}));
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(330),3));
    this.particleMesh=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#f4ffe8',size:.20,transparent:true,opacity:.75,depthWrite:false}));this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);
  }
  splash(position, amount=14) {
    if(!this.settings.effects) return;
    for(const p of this.particles) if(p.life<=0 && amount-- >0){p.position.copy(position);p.position.y+=.4;p.velocity.set((Math.random()-.5)*7,2+Math.random()*6,(Math.random()-.5)*7);p.life=.4+Math.random()*.5;}
  }
  applySettings(settings) {
    this.settings=settings;this.adaptiveLow=false;
    this.renderer.shadowMap.enabled=settings.shadows;
    this.resize();
  }
  resize() {
    const w=innerWidth,h=innerHeight;this.portrait=h>w;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.settings.graphics==='low'||this.adaptiveLow?1:1.5));
    this.renderer.setSize(w,h,false);this.composer?.setSize(w,h);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }
  update(race,time,dt,menu=false) {
    this.waterMaterial.uniforms.time.value=time;
    this.swimmers.update(race.racers,this.track,time,menu,this.camera);
    const player=race.player;
    this.playerMark.visible=!player.eliminated;
    this.playerMark.position.copy(player.position).add(new THREE.Vector3(0,3.5,0));this.playerMark.quaternion.copy(this.camera.quaternion);
    let desired,look;
    if(menu) {
      const target=this.track.main.sample(130).position;
      desired=target.clone().add(new THREE.Vector3(71+Math.sin(time*.07)*3,59,91));
      look=target.clone().add(new THREE.Vector3(-1,-9,-39));
      this.camera.fov=this.portrait?55:46;
      this.camera.setViewOffset(innerWidth,innerHeight,-innerWidth*(this.portrait?.03:.21),this.portrait?innerHeight*.18:0,innerWidth,innerHeight);
    } else {
      const f=this.track[player.route].sample(player.s);
      const cameraBase=this.track[player.route].surface(player.s,player.u*.45);
      desired=cameraBase.clone().addScaledVector(f.tangent,this.portrait?-12.5:-15).add(new THREE.Vector3(0,this.portrait?8.7:8.0,0));
      look=this.track[player.route].surface(Math.min(player.s+17,this.track[player.route].length),player.u*.25).add(new THREE.Vector3(0,1.1,0));
      this.camera.fov=(this.portrait?66:57)+Math.min(player.speed,30)*.1;
      this.camera.clearViewOffset();
    }
    if(!this.cameraReady){this.cameraPosition.copy(desired);this.cameraTarget.copy(look);this.cameraReady=true;}
    this.cameraPosition.lerp(desired,1-Math.exp(-dt*(menu?3:5.5)));this.cameraTarget.lerp(look,1-Math.exp(-dt*7));
    this.camera.position.copy(this.cameraPosition);this.camera.lookAt(this.cameraTarget);this.camera.updateProjectionMatrix();
    if(this.settings.shadows){this.sun.position.copy(player.position).add(new THREE.Vector3(35,75,35));this.sun.target.position.copy(player.position);}
    const positions=this.particleMesh.geometry.attributes.position;
    this.particleMesh.visible=this.settings.effects;
    this.particles.forEach((p,i)=>{
      if(p.life>0){p.life-=dt;p.velocity.y-=10*dt;p.position.addScaledVector(p.velocity,dt);positions.setXYZ(i,p.position.x,p.position.y,p.position.z);}
      else positions.setXYZ(i,0,-1000,0);
    });positions.needsUpdate=true;
    if(!menu&&this.settings.effects&&player.state==='Sliding'&&player.speed>18&&Math.random()<.4)this.splash(player.position,2);
  }
  render(){if(this.settings.postprocessing&&!this.adaptiveLow)this.composer.render();else this.renderer.render(this.scene,this.camera);}
}
