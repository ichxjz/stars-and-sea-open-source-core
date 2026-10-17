import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const candidates = [process.env.BROWSER_EXECUTABLE, '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', path.join(homedir(),'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(existsSync);
assert.ok(executablePath,'Set BROWSER_EXECUTABLE to an installed Chromium browser');
const browser = await chromium.launch({ executablePath, headless: true });
const report = { executable: path.basename(executablePath), data: 'synthetic GP fixture only, not live-feed acceptance', checks: [] };
const epoch = new Date().toISOString().replace(/Z$/,'');
const records = Array.from({length:180},(_,i)=>({NORAD_CAT_ID:900001+i,OBJECT_NAME:`SYNTHETIC TEST ${i+1}`,EPOCH:epoch,MEAN_MOTION:14+i%20/10,ECCENTRICITY:.0001,INCLINATION:30+i%60,RA_OF_ASC_NODE:i*137.5%360,ARG_OF_PERICENTER:i*23%360,MEAN_ANOMALY:i*47%360,BSTAR:0,MEAN_MOTION_DOT:0,MEAN_MOTION_DDOT:0}));
await mkdir('output/source-browser',{recursive:true});
try {
  for (const width of [1440,390]) {
    const context = await browser.newContext({ viewport:{width,height:width===390?844:1000},isMobile:width===390,hasTouch:width===390 });
    const page = await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const requests=[]; page.on('request',request=>requests.push(request.url()));
    await page.route('https://celestrak.org/**',route=>route.fulfill({status:503,body:'offline test'}));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'进入图谱'}).click();
    assert.equal(requests.some(url=>url.includes('celestrak.org')),false,'No satellite feed should load on the opening page');
    await page.getByLabel('选择天体').selectOption('earth');
    await page.getByRole('status').filter({hasText:'公开轨道读取失败'}).waitFor();
    await page.locator('.earth-import input').setInputFiles({name:'synthetic-qa-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(records))});
    await page.waitForFunction(()=>document.querySelector('.earth-test-state')?.getState?.()?.valid>100);
    const state = () => page.locator('.earth-test-state').evaluate(element=>element.getState());
    const before=(await state()).camera;
    await page.getByRole('button',{name:'关闭地球档案'}).click();
    await page.screenshot({path:`output/source-browser/initial-${width}.png`});
    const box=await page.locator('.earth-viewport').boundingBox();
    const picked = new Set();
    for(let n=0;n<3;n++) {
      const available=(await state()).targets.filter(target=>!picked.has(target.index)&&target.y>220&&target.y<box.height-140&&target.x>40&&target.x<box.width-40);
      assert.ok(available.length,'A visible physical satellite must be available');
      const target=available[Math.floor(available.length/2)];picked.add(target.index);
      if(width===390) await page.touchscreen.tap(box.x+target.x,box.y+target.y);
      else await page.mouse.click(box.x+target.x,box.y+target.y);
      await page.waitForFunction(index=>document.querySelector('.earth-test-state')?.getState?.()?.trackSamples[index]===241,target.index);
    }
    const snapshot=await state();assert.equal(Object.keys(snapshot.trackSamples).length,3);
    if(width===1440) {
      const target=snapshot.targets.find(item=>item.y>230&&item.y<box.height-140);
      await page.mouse.move(box.x+target.x,box.y+target.y);
      assert.equal(await page.locator('.earth-snap-cursor').isVisible(),true);
      assert.notEqual(await page.locator('.earth-viewport canvas').evaluate(element=>getComputedStyle(element).cursor),'none');
      await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.57,box.y+box.height*.55,{steps:12});await page.mouse.up();
    } else {
      await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.42);await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.42);
    }
    await page.waitForTimeout(700);assert.notDeepEqual((await state()).camera,before);
    await page.getByRole('button',{name:'地球任务档案',exact:true}).click();
    await page.waitForTimeout(1200);
    const observationRadius=Math.hypot(...(await state()).camera);
    await page.getByRole('button',{name:'向阳面',exact:true}).click();await page.waitForTimeout(150);
    let camera=(await state()).camera;assert.ok(Math.abs(Math.hypot(...camera)-observationRadius)<.01,JSON.stringify({width,observationRadius,camera}));assert.ok(camera[0]<-1&&Math.abs(camera[2])<.01);
    await page.getByRole('button',{name:'背光面',exact:true}).click();await page.waitForTimeout(150);
    camera=(await state()).camera;assert.ok(camera[0]>1&&Math.abs(camera[2])<.01);
    assert.equal(await page.locator('.solar-author-watermark').isVisible(),false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`output/source-browser/earth-${width}.png`});
    await page.getByRole('button',{name:'← 太阳系总览',exact:true}).click();
    assert.equal(await page.locator('.earth-view').count(),0);assert.equal(await page.locator('.solar-author-watermark').isVisible(),true);
    await page.getByLabel('选择天体').selectOption('mars');
    await page.waitForTimeout(800);assert.equal(await page.locator('.solar-detail h2').textContent(),'MARS');
    assert.deepEqual(errors,[]);
    report.checks.push({width,valid:snapshot.valid,physicalPicks:picked.size,samples:Object.values(snapshot.trackSamples),noErrors:true,initialCamera:before,finalCamera:camera});
    await context.close();
  }
  await writeFile('output/source-browser/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); await new Promise(resolve=>server.httpServer.close(resolve)); }
