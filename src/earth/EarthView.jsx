import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LensControls } from '../solar/earth/lens-controls.js';
import { SurfaceTiles } from '../solar/earth/surface-tiles.js';
import { installTouchTap } from '../solar/touch-tap.js';
import { surface, coordinates, visibleAboveHorizon, MAX_WATCHED } from '../solar/earth/math.js';
import { nearestTarget, readOrbitRecords } from './orbit-model.js';
import './earth.css';

const orbitUrl = import.meta.env.VITE_ORBIT_URL || 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';
let cached;

export default function EarthView({ onOverview, hideArtificial, hideOrbits }) {
  const host = useRef(), api = useRef(), input = useRef(), layers = useRef();
  layers.current = { hideArtificial, hideOrbits };
  const [status, setStatus] = useState('正在读取公开 GP 轨道…'), [query, setQuery] = useState('');
  const [records, setRecords] = useState([]), [selected, setSelected] = useState(null), [archive, setArchive] = useState(true);
  const [map, setMap] = useState(false), [cameraSide, setCameraSide] = useState('terminator'), [retry, setRetry] = useState(0);
  useEffect(() => {
    setRecords([]); setSelected(null); setStatus('正在读取公开 GP 轨道…');
    const node = host.current, cleanups = [], tracks = new Map(), clock = new THREE.Clock();
    let disposed = false, frameId, frame, watched = [], selectedIndex = -1, targets = [], data = [], down, lastTiles = 0, follow = false, mapEnabled = false, zoomed = false, cursorPointer = null, fitted = false;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setStatus('WebGL 不可用；请启用硬件加速后重试。'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setClearColor('#050505'); node.append(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .00003, 100);
    camera.position.fromArray(surface(20, 90, 3.5)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const controls = new LensControls(camera, renderer.domElement, { rotateOnPrimary: true, maxDistance: 30 });
    const material = new THREE.MeshStandardMaterial({ color: '#7a9eaa', roughness: 1 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material); scene.add(globe);
    scene.add(new THREE.AmbientLight('#b7c1da', .7));
    const light = new THREE.DirectionalLight('#fff0d2', 3); light.position.set(-4, 0, 0); scene.add(light);
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}solar/textures/earth_daymap.jpg`, value => {
      if (disposed) { value.dispose(); return; }
      value.colorSpace = THREE.SRGBColorSpace; material.map = value; material.color.set('#ffffff'); material.needsUpdate = true;
    });
    const geometry = new THREE.BufferGeometry();
    const pointMaterial = new THREE.PointsMaterial({ color: '#d8e4ec', size: 2.4, sizeAttenuation: false });
    const points = new THREE.Points(geometry, pointMaterial); points.frustumCulled = false; scene.add(points);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.009, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff674a' })); marker.visible = false; scene.add(marker);
    const tileStatus = document.createElement('span'); tileStatus.className = 'earth-tile-status'; node.append(tileStatus);
    const tiles = new SurfaceTiles(scene, tileStatus, { renderer, maxZoom: 19 }); tiles.group.visible = false;
    const cursor = document.createElement('div'); cursor.className = 'earth-snap-cursor'; cursor.hidden = true; node.append(cursor);
    const label = document.createElement('span'); label.className = 'earth-hover-label'; node.append(label);
    const worker = new Worker(new URL('./orbits.worker.js', import.meta.url), { type: 'module' });
    const vector = new THREE.Vector3(), projected = new THREE.Vector3();
    const resize = () => {
      const width = node.clientWidth, height = node.clientHeight; if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
      if (!fitted) {
        const radius = Math.min(width, height) * .42;
        camera.position.setLength(Math.sqrt(1 + (height / (2 * radius * Math.tan(camera.fov * Math.PI / 360))) ** 2));
        camera.lookAt(controls.target); controls.sync(); fitted = true;
      }
    };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    function accept(value, source) {
      const next = readOrbitRecords(value);
      data = next; watched = []; selectedIndex = -1; setSelected(null); setRecords(next);
      for (const track of tracks.values()) { track.geometry.dispose(); track.material.dispose(); scene.remove(track); } tracks.clear();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(next.length * 3), 3));
      frame = null; marker.visible = false; targets = [];
      setStatus(`${next.length.toLocaleString()} 条轨道 · ${source} · SGP4 推算，非实时遥测`);
      worker.postMessage({ type: 'init', records: next });
    }
    worker.onmessage = ({ data: next }) => {
      if (disposed || next.valid.length !== data.length) return;
      frame = next;
      for (const { index, points: vertices } of next.tracks) {
        let track = tracks.get(index);
        if (!track) { track = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ff674a', transparent: true, opacity: .75 })); tracks.set(index, track); scene.add(track); }
        track.geometry.dispose(); track.geometry = new THREE.BufferGeometry(); track.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); track.frustumCulled = false;
      }
    };
    worker.onerror = () => { if (!disposed) setStatus('轨道计算未能启动。请重新打开地球或重试。'); };
    function select(index) {
      if (!frame?.valid[index]) return;
      selectedIndex = index; if (!watched.includes(index)) watched.push(index);
      if (watched.length > MAX_WATCHED) { const old = watched.shift(), track = tracks.get(old); if (track) { scene.remove(track); track.geometry.dispose(); track.material.dispose(); tracks.delete(old); } }
      setSelected(data[index]); worker.postMessage({ type: 'watch', indices: watched });
    }
    function targetAt(position) {
      const rect = node.getBoundingClientRect();
      return nearestTarget(targets, position.x - rect.left, position.y - rect.top, 22);
    }
    function pointerMove(event) {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) down.moved = true;
      if (event.pointerType === 'touch') return;
      cursorPointer = event;
      const target = targetAt({ x: event.clientX, y: event.clientY }), rect = node.getBoundingClientRect();
      cursor.hidden = false; cursor.classList.toggle('is-snapped', !!target);
      cursor.style.left = `${target?.x ?? event.clientX - rect.left}px`; cursor.style.top = `${target?.y ?? event.clientY - rect.top}px`;
      label.textContent = target ? data[target.index].OBJECT_NAME : '';
      label.style.left = `${(target?.x ?? 0) + 16}px`; label.style.top = `${target?.y ?? 0}px`;
      renderer.domElement.style.cursor = target ? 'pointer' : 'grab';
    }
    const listen = (target, name, fn) => { target.addEventListener(name, fn); cleanups.push(() => target.removeEventListener(name, fn)); };
    listen(renderer.domElement, 'pointermove', pointerMove);
    listen(renderer.domElement, 'pointerleave', () => { cursorPointer = null; cursor.hidden = true; label.textContent = ''; });
    listen(renderer.domElement, 'pointerdown', event => { down = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null; });
    listen(window, 'pointerup', event => {
      const tap = down; down = null;
      if (event.pointerType === 'touch' || !tap || tap.moved || event.button !== 0 || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 5) return;
      const target = targetAt({ x: event.clientX, y: event.clientY }); if (target) select(target.index);
    });
    listen(window, 'pointercancel', () => { down = null; });
    const double = () => { controls.zoom(zoomed ? 2 : .5); zoomed = !zoomed; };
    cleanups.push(installTouchTap(renderer.domElement, { capture: targetAt, single: position => { if (position.data) select(position.data.index); }, double }));
    listen(document, 'visibilitychange', () => { worker.postMessage({ type: 'pause', value: document.hidden }); if (!document.hidden) clock.getDelta(); });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    if (cached && Date.now() - cached.time < 5 * 3600000) { accept(cached.records, '本页已读取缓存'); clearTimeout(timeout); }
    else fetch(orbitUrl, { signal: controller.signal, credentials: 'omit' }).then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = readOrbitRecords(await response.json()); if (disposed) return;
      cached = { time: Date.now(), records: value }; accept(value, 'CelesTrak 公开 GP');
    }).catch(error => { if (!disposed && !data.length) setStatus(`公开轨道读取失败（${error.name === 'AbortError' ? '超过 12 秒' : error.message}）。可重试或导入 GP JSON；地球仍可操作。`); }).finally(() => clearTimeout(timeout));
    const debug = { targets: [], trackSamples: {}, camera: [], valid: 0 };
    api.current = { select, accept: (value, source) => { readOrbitRecords(value); controller.abort(); accept(value, source); }, zoom: factor => controls.zoom(factor), map: value => { mapEnabled = value; tiles.group.visible = value; if (!value) tiles.cancelPending(); }, observe: side => {
      follow = false; controls.target.set(0, 0, 0);
      const direction = side === 'day' ? [-1, 0, 0] : side === 'night' ? [1, 0, 0] : [0, 0, 1];
      const distance = Math.max(1.01, camera.position.length());
      camera.position.fromArray(direction).multiplyScalar(distance); camera.lookAt(controls.target); camera.updateMatrixWorld(); controls.sync();
    }, follow: () => { follow = !follow; }, debug };
    const animate = () => {
      frameId = requestAnimationFrame(animate); if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), .06); controls.update(dt); points.visible = !layers.current.hideArtificial;
      for (const [index,line] of tracks) line.visible = !layers.current.hideArtificial && !layers.current.hideOrbits && !!frame?.valid[index];
      marker.visible = false;
      if (frame) {
        const amount = THREE.MathUtils.clamp((Date.now() - frame.time) / 2000, 0, 1), attribute = geometry.getAttribute('position'); targets = [];
        for (let i = 0; i < data.length; i++) {
          if (!frame.valid[i]) { attribute.setXYZ(i, 0, 0, 0); continue; }
          vector.fromArray(frame.positions, i * 3).lerp(projected.fromArray(frame.next, i * 3), amount); attribute.setXYZ(i, vector.x, vector.y, vector.z);
          if (layers.current.hideArtificial || !visibleAboveHorizon(camera.position.toArray(), vector.toArray())) continue;
          projected.copy(vector).project(camera);
          if (projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1) targets.push({ index: i, x: (projected.x * .5 + .5) * node.clientWidth, y: (-projected.y * .5 + .5) * node.clientHeight });
        }
        attribute.needsUpdate = true;
        if (selectedIndex >= 0 && frame.valid[selectedIndex]) {
          marker.position.fromBufferAttribute(attribute, selectedIndex); marker.visible = points.visible;
          if (follow) { camera.position.copy(marker.position).multiplyScalar(1.3); controls.target.copy(marker.position); camera.lookAt(controls.target); camera.updateMatrixWorld(); controls.sync(); }
        }
        debug.targets = targets; debug.trackSamples = Object.fromEntries([...tracks].map(([id, line]) => [id, line.geometry.getAttribute('position')?.count || 0])); debug.valid = frame.valid.reduce((a,b) => a+b, 0);
      }
      if (mapEnabled && performance.now() - lastTiles > 300) { tiles.update(camera); lastTiles = performance.now(); }
      for (const line of tracks.values()) line.material.opacity = .65 + .1 * Math.sin(performance.now() / 700);
      if (cursorPointer) pointerMove(cursorPointer);
      debug.camera = camera.position.toArray(); renderer.render(scene, camera);
    }; animate();
    return () => {
      disposed = true; clearTimeout(timeout); controller.abort(); cancelAnimationFrame(frameId); observer.disconnect(); cleanups.forEach(fn => fn());
      worker.terminate(); controls.dispose(); tiles.dispose(); texture.dispose();
      scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); }); renderer.dispose(); node.replaceChildren(); api.current = null;
    };
  }, [retry]);
  useEffect(() => { api.current?.map(map); }, [map, retry]);
  const results = records.filter(record => `${record.OBJECT_NAME} ${record.NORAD_CAT_ID}`.toUpperCase().includes(query.trim().toUpperCase())).slice(0, 8);
  return <section className="earth-view" aria-label="地球卫星增强视图">
    <div className="earth-viewport" ref={host}/>
    <nav className="earth-navigation"><button onClick={onOverview}>← 太阳系总览</button><button onClick={() => setArchive(value => !value)} aria-expanded={archive}>地球任务档案</button></nav>
    <aside className="earth-archive" hidden={!archive}>
      <div className="earth-archive-heading"><h2>地球 · 卫星轨道</h2><button onClick={() => setArchive(false)} aria-label="关闭地球档案">关闭 ×</button></div>
      <p role="status">{status}</p><button onClick={() => setRetry(value => value + 1)}>重新读取轨道</button>
      <label className="earth-import">导入 GP JSON<input ref={input} type="file" accept=".json,application/json" onChange={async event => {
        const file = event.target.files?.[0]; if (!file) return;
        try { if (file.size > 32 * 1024 * 1024) throw new Error('文件超过 32 MB'); api.current?.accept(JSON.parse(await file.text()), '用户导入'); }
        catch (error) { setStatus(error.message); } finally { if (input.current) input.current.value = ''; }
      }}/></label>
      <label>卫星名称 / NORAD 编号<input value={query} onChange={event => setQuery(event.target.value)} placeholder="输入名称或编号"/></label>
      {query && <div className="earth-results">{results.map(record => <button key={record.NORAD_CAT_ID} onClick={() => api.current?.select(records.indexOf(record))}>{record.OBJECT_NAME}</button>)}</div>}
      {selected && <section className="earth-selected"><h3>{selected.OBJECT_NAME}</h3><p>NORAD {selected.NORAD_CAT_ID} · 周期 {(1440 / selected.MEAN_MOTION).toFixed(1)} 分钟</p><p>历元 {selected.EPOCH} UTC</p><p>选择多颗可叠加轨道；每条 241 个推算样点。</p><button onClick={() => api.current?.follow()}>切换跟随卫星</button></section>}
      <fieldset><legend>观察这个世界</legend>{[['day','向阳面'],['terminator','晨昏线'],['night','背光面']].map(([id, name]) => <button key={id} aria-pressed={cameraSide === id} onClick={() => { setCameraSide(id); api.current?.observe(id); }}>{name}</button>)}</fieldset>
      <p>公开 GP 数据由提供方与网络决定；没有可用轨道时不生成示意卫星。支持鼠标拖动、滚轮、双指与双击触屏缩放。</p>
      <p className="earth-attribution">© <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope · CC BY 4.0</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Esri</p>
    </aside>
    <nav className="earth-controls"><button aria-label="放大地球" onClick={() => api.current?.zoom(.8)}>＋</button><button aria-label="缩小地球" onClick={() => api.current?.zoom(1.25)}>−</button><button aria-pressed={map} onClick={() => setMap(value => !value)}>地理地图</button></nav>
    <output className="earth-test-state" ref={element => { if (element) element.getState = () => api.current?.debug; }} aria-hidden="true"/>
  </section>;
}
