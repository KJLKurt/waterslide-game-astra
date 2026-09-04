import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

// Serve one unchanged production build at two sibling paths to catch origin-wide PWA bugs.
const root=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const match=pathname.match(/^\/(slide-check|other-game)\/(.*)$/);
  if(!match){res.writeHead(404);res.end();return;}
  const relative=match[2]||'index.html';const filename=resolve(root,relative);
  if(!filename.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{await stat(filename);res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(await readFile(filename));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
await mkdir('output/verification',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const report={checks:[],errors:[],requests:[]};
const check=(name)=>{report.checks.push(name);console.log('PASS',name);};
let context;
try{
  context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
  page.on('request',req=>{if(!req.url().startsWith(origin)&&!req.url().startsWith('data:'))report.requests.push(req.url());});
  const state=async()=>JSON.parse(await page.evaluate(()=>render_game_to_text()));
  const advance=async ms=>page.evaluate(ms=>advanceTime(ms),ms);
  await page.goto(origin+'/slide-check/');await page.waitForFunction(()=>window.render_game_to_text);
  assert.equal((await state()).screen,'menu');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;await caches.open('unrelated-pwa:keep-me');});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const scope=await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope);
  assert.equal(scope,origin+'/slide-check/');
  const precache=await page.evaluate(async()=>{const names=await caches.keys();const own=names.find(k=>k.startsWith('splashline:/slide-check/:'));return{names,urls:(await(await caches.open(own)).keys()).map(r=>r.url)};});
  assert.ok(precache.urls.some(url=>url.endsWith('/slide-check/')));
  assert.ok(precache.urls.some(url=>url.includes('/assets/three-')));
  assert.ok(precache.urls.every(url=>url.startsWith(origin+'/slide-check/')));
  const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel=manifest]').href)).json());assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
  check('Production app, manifest and complete precache load under a repository subpath');
  await page.screenshot({path:'output/verification/menu-desktop.png'});

  await page.click('[data-palette="2"]');await page.click('[data-accessory="cap"]');await page.click('#settings-open');
  await page.selectOption('#graphics','low');await page.selectOption('#handedness','left');await page.check('#shadows');await page.check('#postprocessing');await page.check('#music');
  await page.locator('#sensitivity').fill('1.3');await page.locator('#sensitivity').dispatchEvent('input');
  await page.screenshot({path:'output/verification/settings.png'});
  await page.click('#settings-done');await page.reload();await page.waitForFunction(()=>window.splashline);
  const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(splashline.profile)));
  assert.equal(saved.palette,2);assert.equal(saved.accessory,'cap');assert.equal(saved.settings.graphics,'low');assert.equal(saved.settings.handedness,'left');assert.equal(saved.settings.sensitivity,1.3);assert.equal(saved.settings.shadows,true);assert.equal(saved.settings.postprocessing,true);assert.equal(saved.settings.music,true);
  assert.equal((await state()).graphics.pixelRatio,1);
  check('Palette, accessory, graphics, audio, sensitivity and handedness survive reload');
  await page.click('#settings-open');await page.selectOption('#graphics','auto');await page.selectOption('#handedness','right');await page.uncheck('#shadows');await page.uncheck('#postprocessing');await page.uncheck('#music');await page.locator('#sensitivity').fill('1');await page.locator('#sensitivity').dispatchEvent('input');await page.click('#settings-done');

  await page.click('#start-btn');assert.equal((await state()).mode,'countdown');await advance(500);await page.screenshot({path:'output/verification/countdown.png'});
  await page.click('#pause');let paused=await state();await advance(1300);assert.equal((await state()).time,paused.time);assert.equal((await state()).countdown,paused.countdown);await page.click('#settings-done');
  await advance(4000);assert.equal((await state()).mode,'racing');
  const before=(await state()).player.u;await page.keyboard.down('ArrowRight');await advance(130);await page.keyboard.up('ArrowRight');assert.ok((await state()).player.u>before+.4);
  await page.keyboard.press('Space');await advance(110);assert.equal((await state()).player.state,'Airborne');await advance(1600);assert.equal((await state()).player.state,'Sliding');
  await page.keyboard.press('KeyP');paused=await state();await advance(800);assert.equal((await state()).time,paused.time);await page.keyboard.press('Escape');assert.equal((await state()).screen,'game');
  await page.screenshot({path:'output/verification/race-desktop.png'});
  check('Countdown, keyboard steering, jump/landing and pause/resume work end to end');
  await advance(36000);assert.equal((await state()).screen,'results');assert.equal((await state()).result.finished,true);assert.ok((await state()).result.time>20);
  await page.screenshot({path:'output/verification/finish.png'});
  assert.ok(await page.evaluate(()=>splashline.profile.best.race>0&&splashline.profile.unlocks.includes('first-splash')));
  check('Real race finish displays rank/time/leaderboard and saves a best time and unlock');
  await page.click('#replay');await advance(3500);await page.keyboard.down('ArrowLeft');await advance(1100);await page.keyboard.up('ArrowLeft');await advance(1700);assert.equal((await state()).screen,'results');assert.equal((await state()).result.finished,false);await page.screenshot({path:'output/verification/fall.png'});
  check('Race edge fall produces elimination and a DNF result');
  await page.click('#result-menu');await page.check('#practice');await page.click('#start-btn');await advance(14000);
  const checkpoint=(await state()).player.checkpoint;assert.ok(checkpoint>12);
  await page.keyboard.down('ArrowRight');await advance(1050);await page.keyboard.up('ArrowRight');await advance(1750);assert.ok((await state()).player.respawns>0);assert.equal((await state()).player.eliminated,false);assert.ok((await state()).player.s>=checkpoint);
  await advance(35000);assert.equal((await state()).result.finished,true);assert.ok(await page.evaluate(()=>splashline.profile.best.practice>0));
  check('Practice restores the last checkpoint after a fall and saves a separate best time');

  // Independent real multitouch via Chrome's input pipeline, not synthetic DOM pointer events.
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();phone.on('pageerror',e=>report.errors.push(e.message));
  await phone.goto(origin+'/slide-check/');await phone.waitForFunction(()=>window.splashline);
  assert.ok((await phone.evaluate(()=>JSON.parse(render_game_to_text()))).graphics.pixelRatio<=1.5);
  await phone.screenshot({path:'output/verification/menu-portrait.png'});
  const touch=await mobile.newCDPSession(phone);
  await phone.click('#start-btn');await phone.evaluate(()=>advanceTime(4400));
  const stick=await phone.locator('#joystick').boundingBox(),jump=await phone.locator('#jump').boundingBox();
  const finger1={x:Math.round(stick.x+stick.width*.65),y:Math.round(stick.y+stick.height/2),id:11};
  const finger2={x:Math.round(jump.x+jump.width/2),y:Math.round(jump.y+jump.height/2),id:22};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1]});
  await phone.evaluate(()=>advanceTime(50));
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1,finger2]});await phone.evaluate(()=>advanceTime(100));
  let mobileState=JSON.parse(await phone.evaluate(()=>render_game_to_text()));
  assert.notEqual(mobileState.controls.stickPointer,null);assert.notEqual(mobileState.controls.jumpPointer,null);assert.equal(mobileState.player.state,'Airborne');assert.ok(mobileState.player.u>0);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger2]});await phone.evaluate(()=>advanceTime(80));
  mobileState=JSON.parse(await phone.evaluate(()=>render_game_to_text()));assert.notEqual(mobileState.controls.stickPointer,null);assert.equal(mobileState.controls.jumpPointer,null);
  await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  mobileState=JSON.parse(await phone.evaluate(()=>render_game_to_text()));assert.equal(mobileState.controls.steer,0);assert.equal(mobileState.controls.stickPointer,null);
  assert.equal(await phone.evaluate(()=>window.scrollY),0);
  await phone.evaluate(()=>advanceTime(1400));await phone.screenshot({path:'output/verification/race-portrait.png'});
  check('Real simultaneous touch steering/jump, independent release and pointer cancellation work');
  await phone.setViewportSize({width:844,height:390});await phone.evaluate(()=>advanceTime(300));
  await phone.screenshot({path:'output/verification/race-landscape.png'});
  for(const selector of ['#joystick','#jump','#pause']){const b=await phone.locator(selector).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=844&&b.y+b.height<=390);}
  await phone.click('#pause');await phone.selectOption('#handedness','left');await phone.click('#settings-done');
  assert.ok((await phone.locator('#joystick').boundingBox()).x>(await phone.locator('#jump').boundingBox()).x);
  await phone.click('#pause');await phone.click('#quit');await phone.screenshot({path:'output/verification/menu-landscape.png'});
  const landscapeMenu = await phone.locator('.menu-content').boundingBox();
  const landscapeHeader = await phone.locator('#menu-header').boundingBox();
  const landscapeFooter = await phone.locator('#menu-footer').boundingBox();
  assert.ok(landscapeMenu.y >= landscapeHeader.y + landscapeHeader.height - 2, 'landscape menu clears the header');
  assert.ok(landscapeMenu.y + landscapeMenu.height < landscapeFooter.y, 'landscape menu clears the footer');
  await phone.setViewportSize({width:320,height:568});await phone.evaluate(()=>advanceTime(200));
  await phone.screenshot({path:'output/verification/menu-small-phone.png'});
  const smallMenu = await phone.locator('.menu-content').boundingBox();
  const smallHeader = await phone.locator('#menu-header').boundingBox();
  const smallFooter = await phone.locator('#menu-footer').boundingBox();
  assert.ok(smallMenu.y >= smallHeader.y + smallHeader.height, 'small phone menu clears the header');
  assert.ok(smallMenu.y + smallMenu.height < smallFooter.y, 'small phone menu clears the footer');
  check('Portrait/landscape and small-phone layouts fit; handedness swaps the controls');
  await mobile.close();

  await page.goto(origin+'/other-game/');await page.waitForFunction(()=>window.splashline);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('/other-game/'));
  await page.click('[data-palette="1"]');
  const registrations=await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope));
  assert.ok(registrations.includes(origin+'/slide-check/'));assert.ok(registrations.includes(origin+'/other-game/'));
  assert.ok((await page.evaluate(()=>caches.keys())).includes('unrelated-pwa:keep-me'));
  assert.equal(await page.evaluate(()=>splashline.profile.best.race),undefined);
  await page.goto(origin+'/slide-check/');await page.waitForFunction(()=>window.splashline);assert.equal(await page.evaluate(()=>splashline.profile.palette),2);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.splashline);assert.equal((await state()).screen,'menu');await page.click('#start-btn');await advance(4800);assert.equal((await state()).mode,'racing');
  await page.screenshot({path:'output/verification/offline.png'});
  await page.goto(origin+'/other-game/');await page.waitForFunction(()=>window.splashline);assert.equal(await page.evaluate(()=>splashline.profile.palette),1);
  check('Two sibling PWAs coexist: independent workers, caches, saves and offline reloads');
  assert.deepEqual(report.requests,[]);assert.deepEqual(report.errors,[]);
  check('No external runtime requests or browser console errors');
  await writeFile('output/verification/report.json',JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
