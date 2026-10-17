import { EventDispatcher, Quaternion, Spherical, Vector3 } from 'three';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
const logHeight = radius => Math.log(Math.sqrt(Math.max(1e-12, radius * radius - 1)));
const radiusFromLogHeight = value => Math.sqrt(1 + Math.exp(value * 2));

export function wheelPixels(event, height) {
  const value = Number(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
  return Number.isFinite(value) ? clamp(value, -180, 180) : 0;
}

// The atlas samples only the last 90 ms and discards a release after a pause.
// A short gesture receives a small residual budget, so a reversal cannot turn
// into a much larger coast than the drag the user actually made.
export class LensInertia {
  constructor() { this.reset(); }
  reset() { this.samples = []; this.last = 0; this.velocity = { x: 0, y: 0 }; this.travel = 0; this.budget = 0; }
  begin(time) { this.reset(); this.last = time; }
  sample(x, y, time) {
    if (!Number.isFinite(x + y + time) || time <= this.last) return;
    this.samples.push({ from: this.last, to: time, x, y }); this.last = time;
    this.samples = this.samples.filter(sample => sample.to > time - .09);
    this.travel += Math.hypot(x, y);
  }
  release(time, reduced = false) {
    this.velocity = { x: 0, y: 0 };
    if (reduced || time - this.last > .1 || !this.samples.length) { this.samples = []; return; }
    let x = 0, y = 0, duration = 0;
    for (const sample of this.samples) {
      const elapsed = sample.to - Math.max(sample.from, time - .09);
      if (elapsed <= 0) continue;
      x += sample.x * elapsed / (sample.to - sample.from);
      y += sample.y * elapsed / (sample.to - sample.from); duration += elapsed;
    }
    this.samples = [];
    if (!duration) return;
    x /= duration; y /= duration;
    const speed = Math.hypot(x, y);
    if (speed < .045) return;
    const gain = Math.min(1, .55 / speed) * .55;
    this.velocity = { x: x * gain, y: y * gain };
    this.budget = Math.min(this.travel * .3, .08);
  }
  get active() { return this.budget > 1e-7 && Math.hypot(this.velocity.x, this.velocity.y) > .001; }
  step(dt) {
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return { x: 0, y: 0 };
    if (dt > .25) { this.reset(); return { x: 0, y: 0 }; }
    const decay = Math.exp(-dt / .62), integral = (1 - decay) * .62;
    let x = this.velocity.x * integral, y = this.velocity.y * integral;
    const travel = Math.hypot(x, y), gain = travel > this.budget ? this.budget / travel : 1;
    x *= gain; y *= gain; this.budget = Math.max(0, this.budget - Math.hypot(x, y));
    this.velocity.x *= decay; this.velocity.y *= decay;
    return { x, y };
  }
}

/**
 * Independent perspective lens input with the native atlas's mouse mapping.
 * Public integration: target, update(dt), zoom(factor), sync(), stop(),
 * setEnabled(bool), dispose(), and start/change/end events. No OrbitControls
 * or private quaternion fields are used. Flights can set the camera directly;
 * update adopts that external pose instead of pulling it back to old input.
 */
export class LensControls extends EventDispatcher {
  constructor(camera, domElement, { minDistance = 1.00012, maxDistance = 3000, rotateOnPrimary = false, reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false } = {}) {
    super();
    this.camera = camera; this.domElement = domElement; this.target = new Vector3();
    this.minDistance = minDistance; this.maxDistance = maxDistance; this.maxPitch = 1.35;
    this.enabled = true; this.enablePan = true; this.enableZoom = true; this.enableRotate = true;
    this.rotateOnPrimary = !!rotateOnPrimary;
    this.reducedMotion = reducedMotion; this.inertia = new LensInertia();
    this._panTarget = new Vector3(); this._lastPosition = new Vector3(); this._lastTarget = new Vector3(); this._lastUp = new Vector3();
    this._up = new Quaternion(); this._upInverse = new Quaternion(); this._spherical = new Spherical();
    this._offset = new Vector3(); this._right = new Vector3(); this._screenUp = new Vector3();
    this._pointers = new Map(); this._gesture = null; this._lastPanSign = { x: 0, y: 0 }; this._lastOrbitSign = { x: 0, y: 0 }; this._zoomSign = 0;
    this._touchAction = domElement.style.touchAction; domElement.style.touchAction = 'none';
    this._window = domElement.ownerDocument?.defaultView || globalThis.window;
    this._handlers = {
      down: event => this._pointerDown(event), move: event => this._pointerMove(event), up: event => this._pointerUp(event),
      cancel: () => this.stop(), wheel: event => this._wheel(event), context: event => event.preventDefault(),
    };
    domElement.addEventListener('pointerdown', this._handlers.down);
    domElement.addEventListener('wheel', this._handlers.wheel, { passive: false });
    domElement.addEventListener('contextmenu', this._handlers.context);
    this._window?.addEventListener('pointermove', this._handlers.move, { passive: false });
    this._window?.addEventListener('pointerup', this._handlers.up);
    this._window?.addEventListener('pointercancel', this._handlers.cancel);
    this._window?.addEventListener('blur', this._handlers.cancel);
    this.sync();
  }
  _time() { return (globalThis.performance?.now?.() || Date.now()) / 1000; }
  _height() { return Math.max(1, this.domElement.clientHeight || this.domElement.getBoundingClientRect?.().height || 1); }
  sync() {
    this.inertia.reset(); this._panTarget.copy(this.target);
    this._up.setFromUnitVectors(this.camera.up.clone().normalize(), new Vector3(0, 1, 0));
    this._upInverse.copy(this._up).invert();
    this._offset.copy(this.camera.position).sub(this.target).applyQuaternion(this._up);
    this._spherical.setFromVector3(this._offset);
    this._yaw = this._yawTarget = this._spherical.theta;
    this._pitch = this._pitchTarget = Math.PI / 2 - this._spherical.phi;
    this._logHeight = this._logHeightTarget = logHeight(clamp(this._spherical.radius, this.minDistance, this.maxDistance));
    this._lastPosition.copy(this.camera.position); this._lastTarget.copy(this.target); this._lastUp.copy(this.camera.up);
    this._lastTime = this._time(); this._zoomSign = 0;
    return this;
  }
  stop() {
    for (const id of this._pointers.keys()) { try { this.domElement.releasePointerCapture?.(id); } catch { /* Already released. */ } }
    this._pointers.clear(); this._gesture = null; this.sync(); return this;
  }
  setEnabled(enabled) { this.enabled = !!enabled; this.stop(); return this; }
  _start(source, resetZoom = false) {
    this.inertia.reset(); this._panTarget.copy(this.target);
    this._yawTarget = this._yaw; this._pitchTarget = this._pitch;
    if (resetZoom) { this._logHeightTarget = this._logHeight; this._zoomSign = 0; }
    this.dispatchEvent({ type: 'start', source });
  }
  _queueZoom(delta, { rebaseOnReverse = true, limitLag = true } = {}) {
    if (!Number.isFinite(delta) || !delta || !this.enableZoom) return;
    const sign = Math.sign(delta);
    if (rebaseOnReverse && this._zoomSign && this._zoomSign !== sign) this._logHeightTarget = this._logHeight;
    this._zoomSign = sign;
    this._logHeightTarget = clamp(this._logHeightTarget + delta, logHeight(this.minDistance), logHeight(this.maxDistance));
    // Bound outstanding input rather than storing dozens of old wheel events.
    if (limitLag) this._logHeightTarget = clamp(this._logHeightTarget, this._logHeight - .45, this._logHeight + .45);
  }
  zoom(factor) {
    if (!this.enabled || !this.enableZoom || !(factor > 0) || !Number.isFinite(factor)) return;
    this._start('zoom'); this._queueZoom(Math.log(factor));
  }
  zoomTo(radius) {
    if(!this.enabled||!this.enableZoom||!Number.isFinite(radius))return;
    this._start('doubletap');this._logHeightTarget=logHeight(clamp(radius,this.minDistance,this.maxDistance));
  }
  _wheel(event) {
    if (!this.enabled || !this.enableZoom) return;
    event.preventDefault(); event.stopPropagation(); this._start('wheel');
    this._queueZoom(wheelPixels(event, this._height()) * .0011);
  }
  _pointerDown(event) {
    if (!this.enabled || event.button > 2) return;
    if (event.pointerType !== 'touch' && this._pointers.size) return;
    this._start('pointer', true); this.inertia.begin(this._time());
    this._lastPanSign = { x: 0, y: 0 }; this._lastOrbitSign = { x: 0, y: 0 };
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' });
    this._mode = event.button === 1 ? 'zoom' : event.button === 2 || event.shiftKey || this.rotateOnPrimary ? 'orbit' : 'pan';
    this._gesture = this._touchGesture();
    try { this.domElement.setPointerCapture?.(event.pointerId); } catch { /* Synthetic input does not always capture. */ }
    if (event.button === 1) event.preventDefault();
  }
  _touchGesture() {
    const values = [...this._pointers.values()];
    if (values.length !== 2 || !values.every(value => value.touch)) return null;
    const [a, b] = values;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  _pan(dx, dy, rebaseOnReverse = true) {
    if (!this.enablePan) return;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    if (rebaseOnReverse && (sx && this._lastPanSign.x && sx !== this._lastPanSign.x || sy && this._lastPanSign.y && sy !== this._lastPanSign.y)) this._panTarget.copy(this.target);
    if (sx) this._lastPanSign.x = sx; if (sy) this._lastPanSign.y = sy;
    this.camera.updateMatrixWorld();
    this._right.setFromMatrixColumn(this.camera.matrixWorld, 0); this._screenUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const radius = radiusFromLogHeight(this._logHeight), altitude = Math.max(this.minDistance - 1, this.camera.position.length() - 1);
    const depth = radius - (1 - smoothstep(.2, .9, altitude));
    // At map altitude the surface, not the planet centre, sits under the hand.
    const worldPerPixel = 2 * Math.max(altitude, depth) * Math.tan(this.camera.fov * Math.PI / 360) / this._height();
    this._panTarget.addScaledVector(this._right, -dx * worldPerPixel).addScaledVector(this._screenUp, dy * worldPerPixel);
  }
  _orbit(dx, dy) {
    if (!this.enableRotate) return;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    if (sx && this._lastOrbitSign.x && sx !== this._lastOrbitSign.x || sy && this._lastOrbitSign.y && sy !== this._lastOrbitSign.y) {
      this._yawTarget = this._yaw; this._pitchTarget = this._pitch; this.inertia.begin(this._time());
    }
    if (sx) this._lastOrbitSign.x = sx; if (sy) this._lastOrbitSign.y = sy;
    const gain = clamp((this.camera.position.length() - 1) / .6, .001, 1), x = -dx * .00075 * gain, y = dy * .00085 * gain;
    this._yawTarget += x;
    const limit = Math.max(this.maxPitch, Math.abs(this._pitch));
    this._pitchTarget = clamp(this._pitchTarget + y, -limit, limit);
    this.inertia.sample(x, y, this._time());
  }
  _pointerMove(event) {
    if (!this.enabled) return;
    const old = this._pointers.get(event.pointerId); if (!old) return;
    const dx = event.clientX - old.x, dy = event.clientY - old.y;
    old.x = event.clientX; old.y = event.clientY;
    const gesture = this._touchGesture();
    if (gesture) {
      if (this._gesture) {
        this._pan(gesture.x - this._gesture.x, gesture.y - this._gesture.y, false);
        if (gesture.distance > 0 && this._gesture.distance > 0) this._queueZoom(Math.log(this._gesture.distance / gesture.distance), { rebaseOnReverse: false, limitLag: false });
      }
      this._gesture = gesture;
    } else if (this._mode === 'orbit') this._orbit(dx, dy);
    else if (this._mode === 'zoom') this._queueZoom(dy * .004);
    else this._pan(dx, dy);
    if (old.touch) event.preventDefault();
  }
  _pointerUp(event) {
    if (!this._pointers.has(event.pointerId)) return;
    this._pointers.delete(event.pointerId); this._gesture = this._touchGesture();
    try { this.domElement.releasePointerCapture?.(event.pointerId); } catch { /* Already released. */ }
    if (!this._pointers.size) { this.inertia.release(this._time(), this.reducedMotion()); this.dispatchEvent({ type: 'end' }); }
  }
  update(dt) {
    const time = this._time(), elapsed = dt ?? time - this._lastTime; this._lastTime = time;
    if (!this.enabled) return false;
    if (this.camera.position.distanceToSquared(this._lastPosition) > 1e-14 || this.target.distanceToSquared(this._lastTarget) > 1e-14 || this.camera.up.distanceToSquared(this._lastUp) > 1e-14) this.sync();
    if (elapsed > .25) this.inertia.reset();
    const delta = clamp(Number.isFinite(elapsed) ? elapsed : 1 / 60, 0, .05);
    if (this.reducedMotion()) this.inertia.reset();
    if (!this._pointers.size && this.inertia.active) {
      const coast = this.inertia.step(delta); this._yawTarget += coast.x;
      this._pitchTarget = clamp(this._pitchTarget + coast.y, -Math.max(this.maxPitch, Math.abs(this._pitch)), Math.max(this.maxPitch, Math.abs(this._pitch)));
    }
    const positional = this.reducedMotion() ? 1 : 1 - Math.pow(.0018, delta), angular = this.reducedMotion() ? 1 : 1 - Math.exp(-4.5 * delta);
    this.target.lerp(this._panTarget, positional);
    this._logHeight += (this._logHeightTarget - this._logHeight) * positional;
    this._yaw += (this._yawTarget - this._yaw) * angular; this._pitch += (this._pitchTarget - this._pitch) * angular;
    if (Math.abs(this._logHeightTarget - this._logHeight) < 1e-8) this._logHeight = this._logHeightTarget;
    if (Math.abs(this._yawTarget - this._yaw) < 1e-8) this._yaw = this._yawTarget;
    if (Math.abs(this._pitchTarget - this._pitch) < 1e-8) this._pitch = this._pitchTarget;
    if (this.target.distanceToSquared(this._panTarget) < 1e-18) this.target.copy(this._panTarget);
    this._spherical.set(radiusFromLogHeight(this._logHeight), Math.PI / 2 - this._pitch, this._yaw);
    this._offset.setFromSpherical(this._spherical).applyQuaternion(this._upInverse);
    this.camera.position.copy(this.target).add(this._offset);
    if (this.camera.position.length() < this.minDistance) { this.camera.position.setLength(this.minDistance); this.sync(); }
    this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
    const changed = this.camera.position.distanceToSquared(this._lastPosition) > 1e-18 || this.target.distanceToSquared(this._lastTarget) > 1e-18;
    this._lastPosition.copy(this.camera.position); this._lastTarget.copy(this.target); this._lastUp.copy(this.camera.up);
    if (changed) this.dispatchEvent({ type: 'change' });
    return changed;
  }
  getState() {
    return { yaw: this._yaw, pitch: this._pitch, radius: radiusFromLogHeight(this._logHeight), radiusTarget: radiusFromLogHeight(this._logHeightTarget), target: this.target.toArray(), panTarget: this._panTarget.toArray(), pointers: this._pointers.size, inertia: this.inertia.active };
  }
  dispose() {
    this.stop(); this.domElement.style.touchAction = this._touchAction;
    this.domElement.removeEventListener('pointerdown', this._handlers.down); this.domElement.removeEventListener('wheel', this._handlers.wheel); this.domElement.removeEventListener('contextmenu', this._handlers.context);
    this._window?.removeEventListener('pointermove', this._handlers.move); this._window?.removeEventListener('pointerup', this._handlers.up); this._window?.removeEventListener('pointercancel', this._handlers.cancel); this._window?.removeEventListener('blur', this._handlers.cancel);
  }
}

export default LensControls;
