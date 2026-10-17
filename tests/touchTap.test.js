import test from 'node:test';
import assert from 'node:assert/strict';
import {installTouchTap} from '../src/solar/touch-tap.js';
function setup(){const element=new EventTarget();let time=0;const singles=[],doubles=[];const dispose=installTouchTap(element,{single:e=>singles.push(e),double:e=>doubles.push(e),now:()=>time});const event=(type,id=1,x=10,y=10)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,pointerType:'touch',clientX:x,clientY:y});element.dispatchEvent(e);return e;};return {element,event,singles,doubles,dispose,advance:ms=>time+=ms};}
test('double touch zoom cancels deferred satellite selection and still releases the camera pointer',async()=>{
  const h=setup();let released=0;h.element.addEventListener('pointerup',()=>released++);h.event('pointerdown');h.event('pointerup');h.advance(120);h.event('pointerdown');
  const e=h.event('pointerup');assert(e.defaultPrevented);await new Promise(r=>setTimeout(r,320));
  assert.equal(h.singles.length,0);assert.equal(h.doubles.length,1);assert.equal(released,2);h.dispose();
});
test('drag and pinch never open a satellite or trigger double zoom',async()=>{
  const h=setup();h.event('pointerdown');h.event('pointermove',1,30,10);h.event('pointerup',1,30,10);
  h.advance(40);h.event('pointerdown',1);h.event('pointerdown',2,20,20);h.event('pointerup',2,20,20);h.event('pointerup',1);
  await new Promise(r=>setTimeout(r,320));assert.equal(h.singles.length,0);assert.equal(h.doubles.length,0);h.dispose();
});
test('one tap remains an intentional satellite selection',async()=>{const h=setup();h.event('pointerdown');h.event('pointerup');await new Promise(r=>setTimeout(r,320));assert.equal(h.singles.length,1);assert.equal(h.doubles.length,0);h.dispose();});

test('delayed single tap retains the moving object identity from release time',async()=>{
  const canvas=new EventTarget(),selected=[];let current=42;
  const dispose=installTouchTap(canvas,{capture:()=>current,single:tap=>selected.push(tap.data)});
  for(const type of ['pointerdown','pointerup']){const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,pointerType:'touch',clientX:10,clientY:10});canvas.dispatchEvent(event);}
  current=99;
  await new Promise(resolve=>setTimeout(resolve,320));
  assert.deepEqual(selected,[42]);dispose();
});
