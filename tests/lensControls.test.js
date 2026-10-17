import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { LensControls, LensInertia, wheelPixels } from '../src/solar/earth/lens-controls.js';

function fixture(radius = 4) {
  const window = new EventTarget(), canvas = new EventTarget();
  Object.assign(canvas, { style: {}, clientHeight: 900, ownerDocument: { defaultView: window }, setPointerCapture() {}, releasePointerCapture() {} });
  const camera = new PerspectiveCamera(42, 1440 / 900, .001, 9000); camera.position.set(0, 0, radius); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const controls = new LensControls(camera, canvas, { reducedMotion: () => false }); let clock = 1;
  controls._time = () => clock;
  const event = (type, values = {}, target = window) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 400, clientY: 420, deltaMode: 0, deltaY: 0 }, values);
    clock += .02; target.dispatchEvent(e);
  };
  const frame = (count = 1, dt = 1 / 60) => { for (let i = 0; i < count; i++) { clock += dt; controls.update(dt); } };
  const down = values => event('pointerdown', values, canvas);
  const move = values => event('pointermove', values);
  const up = values => event('pointerup', values);
  return { camera, controls, canvas, window, event, frame, down, move, up };
}

test('native wheel normalization bounds line/page input and ignores nonfinite values', () => {
  assert.equal(wheelPixels({ deltaY: 5, deltaMode: 1 }, 900), 80);
  assert.equal(wheelPixels({ deltaY: 1, deltaMode: 2 }, 900), 180);
  assert.equal(wheelPixels({ deltaY: -900, deltaMode: 0 }, 900), -180);
  assert.equal(wheelPixels({ deltaY: NaN, deltaMode: 0 }, 900), 0);
});
test('left drag pans the displayed globe by the mouse distance without changing its viewing direction', () => {
  const f = fixture(), before = f.camera.getWorldDirection(new Vector3());
  f.down(); f.move({ clientX: 520 }); f.up({ clientX: 520 }); f.frame(180);
  const projected = new Vector3().project(f.camera), pixels = projected.x * 1440 / 2;
  assert(Math.abs(pixels - 120) < .01, `${pixels} pixel displacement`);
  assert(before.distanceTo(f.camera.getWorldDirection(new Vector3())) < 1e-10);
  f.controls.dispose();
});
test('right and shift drag use native angular gain with bounded release coast', () => {
  for (const values of [{ button: 2 }, { shiftKey: true }]) {
    const f = fixture(); f.down(values);
    for (let i = 1; i <= 4; i++) { f.move({ clientX: 400 + i * 20, ...values }); f.frame(); }
    f.up({ clientX: 480, ...values }); f.frame(240);
    const state = f.controls.getState(); assert(Math.abs(state.yaw + .078) < .001, JSON.stringify(state));
    assert(f.controls.target.length() < 1e-12); f.controls.dispose();
  }
});
test('the native allow-rotation option changes primary drag without changing wheel or subsequent pan', () => {
  const f = fixture(); f.controls.rotateOnPrimary = true; f.down();
  for (let i = 1; i <= 4; i++) { f.move({ clientX: 400 + i * 20 }); f.frame(); }
  f.up({ clientX: 480 }); f.frame(240); assert(f.controls.getState().yaw < -.06); assert(f.controls.target.length() < 1e-10);
  const yaw = f.controls.getState().yaw; f.event('wheel', { deltaY: -120 }, f.canvas); f.frame(180);
  assert(f.controls.getState().radius < 4); assert(Math.abs(f.controls.getState().yaw - yaw) < 1e-7);
  f.controls.rotateOnPrimary = false; f.controls.target.set(0, 0, 0); f.camera.position.set(0, 0, 4); f.controls.sync();
  f.down(); f.move({ clientX: 520 }); f.up({ clientX: 520 }); f.frame(180);
  assert(Math.abs(f.controls.getState().yaw) < 1e-10); assert(f.controls.target.x < -.1); f.controls.dispose();
});
test('a rapid pan reversal cancels pending travel and settles monotonically', () => {
  const f = fixture(); f.down(); f.move({ clientX: 620 }); f.frame(2);
  f.move({ clientX: 540 }); f.up({ clientX: 540 });
  const x = []; for (let i = 0; i < 120; i++) { f.frame(); x.push(f.controls.target.x); }
  for (let i = 1; i < x.length; i++) assert(x[i] >= x[i - 1] - 1e-12);
  const settled = f.controls.target.clone(); f.frame(240); assert(f.controls.target.distanceTo(settled) < .0003); f.controls.dispose();
});
test('a rapid wheel reversal changes direction immediately and never oscillates', () => {
  const f = fixture(); for (let i = 0; i < 20; i++) f.event('wheel', { deltaY: 600 }, f.canvas);
  f.frame(3); const peak = f.camera.position.length();
  for (let i = 0; i < 4; i++) f.event('wheel', { deltaY: -600 }, f.canvas);
  const radii = []; for (let i = 0; i < 150; i++) { f.frame(); radii.push(f.camera.position.length()); }
  assert(radii[0] < peak); for (let i = 1; i < radii.length; i++) assert(radii[i] <= radii[i - 1] + 1e-10);
  const stable = f.camera.position.clone(); f.frame(240); assert(f.camera.position.distanceTo(stable) < 1e-6); f.controls.dispose();
});
test('interleaved two-finger pan does not inject zoom and a centred pinch does not inject pan', () => {
  const f = fixture(); f.down({ pointerType: 'touch', pointerId: 1, clientX: 300 }); f.down({ pointerType: 'touch', pointerId: 2, clientX: 400 });
  f.move({ pointerType: 'touch', pointerId: 1, clientX: 340 }); f.move({ pointerType: 'touch', pointerId: 2, clientX: 440 }); f.frame(180);
  assert(Math.abs(f.controls.getState().radius - 4) < 1e-7); assert(f.controls.target.length() > .01);
  f.controls.target.set(0, 0, 0); f.camera.position.set(0, 0, 4); f.controls.stop();
  f.down({ pointerType: 'touch', pointerId: 1, clientX: 300 }); f.down({ pointerType: 'touch', pointerId: 2, clientX: 400 });
  f.move({ pointerType: 'touch', pointerId: 1, clientX: 250 }); f.move({ pointerType: 'touch', pointerId: 2, clientX: 450 }); f.frame(180);
  assert(f.controls.target.length() < 1e-10); assert(Math.abs(f.controls.getState().radius - Math.sqrt(1 + 15 / 4)) < 1e-7); f.controls.dispose();
});
test('direct flight poses and up changes are adopted without snapping to stale input', () => {
  const f = fixture(); f.controls.zoom(.8); f.frame(2);
  f.camera.position.set(2.1, .3, .4); f.camera.up.set(1, 0, 0); const wanted = f.camera.position.clone();
  f.frame(240); assert(f.camera.position.distanceTo(wanted) < 1e-9); assert(Number.isFinite(f.controls.getState().yaw)); f.controls.dispose();
});
test('disabled controls ignore mouse and wheel events and retain the camera pose', () => {
  const f = fixture(); f.controls.setEnabled(false); const original = f.camera.position.clone();
  f.down(); f.move({ clientX: 750 }); f.up({ clientX: 750 }); f.event('wheel', { deltaY: 800 }, f.canvas); f.frame(180);
  assert(f.camera.position.equals(original)); assert.equal(f.controls.getState().pointers, 0); f.controls.dispose();
});
test('inertia discards stale releases, clears on begin, and remains frame-rate independent', () => {
  const stale = new LensInertia(); stale.begin(1); stale.sample(.1, 0, 1.05); stale.release(1.25); assert.equal(stale.active, false);
  const run = dt => { const inertia = new LensInertia(); inertia.begin(1); inertia.sample(.1, 0, 1.05); inertia.release(1.06); let sum = 0; for (let i = 0; i < Math.ceil(2 / dt); i++) sum += inertia.step(dt).x; return sum; };
  assert(Math.abs(run(1 / 30) - run(1 / 120)) < 1e-9); assert(Math.abs(run(1 / 60) - .03) < 1e-9);
  const inertia = new LensInertia(); inertia.begin(1); inertia.sample(.1, 0, 1.05); inertia.release(1.06); inertia.begin(2); assert.equal(inertia.active, false);
});
