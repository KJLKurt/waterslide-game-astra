import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
await mkdir('public/icons',{recursive:true});await mkdir('output',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
  const svg=await readFile('public/icon.svg','utf8');await page.setContent('<style>*{margin:0}svg{width:100vw;height:100vh;display:block}</style>'+svg);
  await page.screenshot({path:'public/icons/icon-512.png'});await page.setViewportSize({width:192,height:192});await page.screenshot({path:'public/icons/icon-192.png'});
  await page.setViewportSize({width:1440,height:1000});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5188');await page.waitForTimeout(1500);await page.screenshot({path:'output/menu-desktop.png'});
  console.log(await page.evaluate(()=>render_game_to_text()));
  await page.click('#start-btn');await page.evaluate(()=>advanceTime(5600));await page.screenshot({path:'output/race-desktop.png'});
  await page.evaluate(()=>splashline.showMenu());await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:'output/menu-portrait.png'});
  await page.click('#start-btn');await page.evaluate(()=>advanceTime(5100));await page.screenshot({path:'output/race-portrait.png'});
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);await page.screenshot({path:'output/race-landscape.png'});
  console.log('errors',errors);
} finally {await browser.close();}
