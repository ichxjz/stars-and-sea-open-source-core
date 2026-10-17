import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {coordinates,surface,tileAt,tileLatitude} from '../src/solar/earth/math.js';

const source=await readFile(new URL('../src/solar/earth/surface-tiles.js',import.meta.url),'utf8');
const implementation=source.replace(/^import[^\n]+\n/gm,'').replace(/export (class|function)/g,'$1');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness(deferBitmap=false,options={}){
  let clock=0,id=0,maxPending=0;
  const timers=new Map(),requests=[],bitmaps=[],decodes=[];
  const context=vm.createContext({THREE,coordinates,surface,tileAt,tileLatitude,Math,Float32Array,AbortController,
    performance:{now:()=>clock},
    setTimeout(callback,delay){const key=++id;timers.set(key,{callback,at:clock+delay});return key;},
    clearTimeout(key){timers.delete(key);},
    fetch(url,{signal}){return new Promise((resolve,reject)=>{
      const request={url,signal,pending:true,reply(ok=true){request.pending=false;resolve({ok,status:ok?200:502,blob:async()=>({})});}};
      signal.addEventListener('abort',()=>{request.pending=false;reject(new DOMException('Canceled','AbortError'));},{once:true});
      requests.push(request);maxPending=Math.max(maxPending,requests.filter(item=>item.pending).length);
    });},
    createImageBitmap(blob,options){
      const bitmap={width:256,height:256,closed:0,close(){this.closed++;},options};bitmaps.push(bitmap);
      return deferBitmap?new Promise(resolve=>decodes.push(()=>resolve(bitmap))):Promise.resolve(bitmap);
    }
  });
  vm.runInContext(implementation+'\nglobalThis.Tiles=SurfaceTiles;',context);
  const scene=new THREE.Scene(),tiles=new context.Tiles(scene,{textContent:''},options);
  return {tiles,requests,bitmaps,decodes,scene,
    get maxPending(){return maxPending;},get timers(){return timers.size;},
    setClock(value){clock=value;},
    timeout(){clock+=8000;for(const [key,timer]of [...timers])if(timer.at<=clock){timers.delete(key);timer.callback();}}
  };
}
const camera=distance=>({position:new THREE.Vector3(...surface(31.23,121.47,distance)),fov:42,aspect:390/844});
async function loadAll(h){
  for(let round=0;round<200;round++){
    for(const request of h.requests)if(request.pending)request.reply();
    await flush();
    if(!h.tiles.active.size&&!h.tiles.queue.length)return;
  }
  assert.fail('Tile loading did not settle within the bounded test budget');
}

test('changing LOD immediately aborts old requests and gives current parent coverage all six slots',async()=>{
  const h=harness();h.tiles.update(camera(3.15));assert.equal(h.requests.length,6);
  const first=h.requests.slice();h.tiles.update(camera(1.003));
  assert.ok(first.every(request=>request.signal.aborted));assert.equal(h.requests.length,12);
  assert.equal(h.tiles.active.size,6);assert.equal(h.tiles.loading,6);assert.equal(h.maxPending,6);
  const newest=h.requests[6],task=[...h.tiles.active.values()][0];
  assert.ok(task.coarse&&task.z<h.tiles.zoom,'current broad coverage must not wait behind obsolete or fine-level requests');
  assert.ok(newest.url.includes(`/${task.z}/`));
  newest.reply();await flush();assert.ok(h.tiles.group.children.length>0,'current coverage loads without waiting for obsolete requests');
  assert.equal(h.bitmaps[0].options.imageOrientation,'flipY');
  assert.equal(h.tiles.group.children[0].material.map.flipY,false,'orientation is applied once during bitmap decode');
  h.tiles.dispose();await flush();assert.equal(h.timers,0);assert.equal(h.tiles.active.size,0);assert.equal(h.bitmaps[0].closed,1);
});

test('an eight-second timeout frees the slot, while failed tiles wait thirty seconds before retry',async()=>{
  const h=harness();h.tiles.update(camera(1.003));const failed=[...h.tiles.active.values()];
  h.timeout();await flush();assert.ok(h.requests.slice(0,6).every(request=>request.signal.aborted));
  assert.equal(h.tiles.active.size,6);assert.equal(h.maxPending,6);assert.equal(h.tiles.failed,6);
  const key=failed[0].key;assert.equal(h.tiles.cache.get(key).retryAt,38000);
  h.setClock(37999);h.tiles.update(camera(1.003));assert.equal(h.tiles.queue.some(task=>task.key===key),false);
  h.setClock(38000);h.tiles.update(camera(1.003));assert.equal(h.tiles.queue.some(task=>task.key===key),true);
  h.tiles.clear();await flush();assert.equal(h.tiles.active.size,0);assert.equal(h.timers,0);
});

test('loaded fallback survives zoom and a style switch, while only canceled late bitmap decodes close',async()=>{
  const h=harness(true);h.tiles.update(camera(3.15));h.requests[0].reply();await flush();h.decodes[0]();await flush();
  const fallback=h.tiles.group.children[0];assert.ok(fallback);
  h.tiles.update(camera(1.003));assert.equal(fallback.visible,true);
  const near=h.requests.find(request=>request.pending);near.reply();await flush();
  assert.equal(h.decodes.length,2);h.tiles.change('satellite');h.decodes[1]();await flush();
  assert.equal(h.tiles.group.children.length,1);assert.equal(h.tiles.cache.size,1);assert.equal(h.tiles.active.size,0);
  assert.equal(fallback.visible,false,'the retained map fallback must be hidden in satellite mode');
  assert.equal(h.bitmaps[0].closed,0,'a loaded cached texture is reusable, not disposed on a style switch');
  assert.equal(h.bitmaps[1].closed,1,'late decode from the canceled style must release its bitmap');
  h.tiles.update(camera(1.003));assert.ok(h.requests.at(-1).url.includes('World_Imagery/MapServer/tile/'));
  h.tiles.dispose();await flush();assert.equal(h.timers,0);assert.equal(h.scene.children.length,0);
  assert.ok(h.bitmaps.every(bitmap=>bitmap.closed===1),'final teardown closes both retained and canceled resources exactly once');
});

test('HD resolution follows actual drawing-buffer pixels and establishes parent coverage before centre detail',async()=>{
  const renderer=(width,height)=>({getDrawingBufferSize:target=>target.set(width,height)});
  const low=harness(false,{renderer:renderer(800,900)}),high=harness(false,{renderer:renderer(1600,1800)});
  const at=camera(1.003),a=low.tiles.plan(at),b=high.tiles.plan(at);
  assert.equal(b.z,a.z+1,'doubling DPR needs another raster level');
  const circumference=2*Math.PI*Math.cos(b.geo.latitude*Math.PI/180);
  const tilePixels=circumference/(2**b.z)/b.perPixel;
  assert.ok(tilePixels<=256.01,'256px sources are not stretched beyond their native physical pixel width');
  assert.ok([...b.tasks.values()].some(task=>task.z===b.z-3),'parent coverage accompanies sharp centre tiles');
  high.tiles.update(at);
  assert.equal([...high.tiles.active.values()][0].z,b.z-3,'a coarse parent arrives before the full-resolution centre');
  assert.ok([...high.tiles.active.values()].every(task=>task.coarse),'the first batch covers the view before spending slots on detail');
  await loadAll(high);
  assert.ok([...b.detail].every(key=>high.tiles.cache.get(key)?.mesh),'sharp centre detail must still finish after parent coverage');
  low.tiles.dispose();high.tiles.dispose();
});

test('panning follows the camera ray hit instead of its sub-camera longitude',()=>{
  const h=harness(false,{renderer:{getDrawingBufferSize:target=>target.set(1600,1000)}});
  const view=new THREE.PerspectiveCamera(42,1.6,.000001,20);
  view.position.fromArray(surface(31.23,121.47,1.003));
  const target=new THREE.Vector3(...surface(31.23,121.52));view.lookAt(target);view.updateProjectionMatrix();
  const plan=h.tiles.plan(view,target);
  assert.ok(Math.abs(plan.geo.longitude-121.52)<.0001,'centre uses the visible district after a surface pan');
  assert.ok(Math.abs(plan.geo.longitude-coordinates(view.position.toArray()).longitude)>.04);
  h.tiles.dispose();
});

test('map textures retain filtered mipmaps, anisotropy and 82 percent of real semantic map colour',async()=>{
  const h=harness(false,{renderer:{getDrawingBufferSize:target=>target.set(800,900),capabilities:{getMaxAnisotropy:()=>8}}});
  h.tiles.update(camera(1.003));h.requests[0].reply();await flush();
  const material=h.tiles.group.children[0].material;
  assert.equal(material.map.magFilter,THREE.LinearFilter);
  assert.equal(material.map.minFilter,THREE.LinearMipmapLinearFilter);
  assert.equal(material.map.anisotropy,8);
  const shader={fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/mix\(vec3\(kkLuma\),diffuseColor\.rgb,\.82\)/);
  assert.doesNotMatch(shader.fragmentShader,/kkWaterSignal|kkWater|step\(/,'water, roads and rail are not converted to a binary grey mask');
  assert.match(shader.fragmentShader,/#include <map_fragment>/,'the original colour map remains in the compiled material');
  h.tiles.dispose();await flush();
});

for(const [width,height]of [[1600,1800],[3456,1916],[3840,2160]])test(`map to satellite to map at ${width}×${height} reuses loaded meshes without fetching the previous style again`,async()=>{
  const h=harness(false,{renderer:{getDrawingBufferSize:target=>target.set(width,height)}}),view=camera(1.003);
  view.aspect=width/height;
  h.tiles.update(view);await loadAll(h);
  const originalMap=new Map([...h.tiles.cache].filter(([key,entry])=>key.startsWith('map/')&&entry.mesh).map(([key,entry])=>[key,entry.mesh]));
  assert.ok(originalMap.size>6);
  h.tiles.change('satellite');assert.ok([...originalMap.values()].every(mesh=>!mesh.visible));
  h.tiles.update(view);await loadAll(h);
  const satellites=[...h.tiles.cache].filter(([key,entry])=>key.startsWith('satellite/')&&entry.mesh).map(([,entry])=>entry.mesh);
  assert.ok(satellites.length>6);assert.ok(satellites.every(mesh=>mesh.visible));
  const requests=h.requests.length;h.tiles.change('map');h.tiles.update(view);await flush();
  assert.equal(h.requests.length,requests,'returning to the same loaded map view must not start another tile request');
  for(const [key,mesh]of originalMap){assert.equal(h.tiles.cache.get(key)?.mesh,mesh);assert.equal(mesh.visible,true);}
  assert.ok(satellites.every(mesh=>!mesh.visible),'other style stays cached but cannot cover the selected map');
  h.tiles.dispose();await flush();assert.ok(h.bitmaps.every(bitmap=>bitmap.closed===1));
});

test('zooming back reuses the complete loaded view and hides obsolete close-up detail',async()=>{
  const h=harness(),far=camera(3.15),near=camera(1.003);
  h.tiles.update(far);await loadAll(h);
  const farPlan=h.tiles.lastPlan,farMeshes=new Map([...farPlan.wanted].map(key=>[key,h.tiles.cache.get(key).mesh]));
  h.tiles.update(near);
  assert.ok([...farMeshes.values()].some(mesh=>mesh.visible),'existing broad coverage remains while near detail is pending');
  await loadAll(h);const closeUp=[...h.tiles.lastPlan.detail].map(key=>h.tiles.cache.get(key).mesh),requests=h.requests.length;
  h.tiles.update(far);await flush();
  assert.equal(h.requests.length,requests,'returning to a loaded zoom level must not fetch it again');
  for(const [key,mesh]of farMeshes){assert.equal(h.tiles.cache.get(key)?.mesh,mesh);assert.equal(mesh.visible,true,'all previously loaded coverage returns immediately');}
  assert.ok(closeUp.every(mesh=>!mesh.visible),'unrelated fine tiles do not cover the restored wide view');
  h.tiles.dispose();await flush();assert.ok(h.bitmaps.every(bitmap=>bitmap.closed===1));
});

test('panning bounds historical cache while preserving the other style view and releasing evicted textures',async()=>{
  const h=harness(false,{renderer:{getDrawingBufferSize:target=>target.set(1600,1800)}}),view=camera(1.003);
  view.aspect=1600/1800;
  h.tiles.update(view);await loadAll(h);
  const watched=[...h.tiles.cache.values()].map(({mesh})=>{
    const count={geometry:0,texture:0,material:0};
    mesh.geometry.addEventListener('dispose',()=>count.geometry++);
    mesh.material.map.addEventListener('dispose',()=>count.texture++);
    mesh.material.addEventListener('dispose',()=>count.material++);
    return count;
  });
  h.tiles.change('satellite');h.tiles.update(view);await loadAll(h);
  const satelliteView=new Map([...h.tiles.cache].filter(([key,entry])=>key.startsWith('satellite/')&&entry.mesh).map(([key,entry])=>[key,entry.mesh]));
  h.tiles.change('map');
  for(const longitude of [121.47,131.47,141.47,151.47,161.47,171.47,181.47,191.47]){
    view.position.fromArray(surface(31.23,longitude,1.003));h.tiles.update(view);await loadAll(h);
    assert.ok(h.tiles.cache.size<=850,'history must remain bounded instead of accumulating every panned region');
    for(const [key,mesh]of satelliteView){assert.equal(h.tiles.cache.get(key)?.mesh,mesh);assert.equal(mesh.visible,false);}
    assert.ok([...h.tiles.lastPlan.wanted].every(key=>h.tiles.cache.get(key)?.mesh?.visible),'current visible coverage is never an eviction victim');
  }
  assert.ok(h.bitmaps.some(bitmap=>bitmap.closed===1),'older unprotected regions actually release their resources');
  assert.ok(watched.some(count=>count.geometry===1),'history eviction disposes real geometry objects');
  assert.ok(watched.every(count=>count.geometry===count.texture&&count.texture===count.material),'eviction releases geometry, texture and material together');
  h.tiles.dispose();await flush();assert.ok(h.bitmaps.every(bitmap=>bitmap.closed===1),'teardown releases retained and already evicted textures exactly once');
  assert.ok(watched.every(count=>count.geometry===1&&count.texture===1&&count.material===1),'final teardown never double-disposes previously evicted resources');
  assert.equal(h.tiles.retainedPlans.size,0,'teardown does not retain old view keys');
});
