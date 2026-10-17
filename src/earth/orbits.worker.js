import { makeSatellites, satellitePoint, trajectory } from './orbit-model.js';

let records = [], satellites = [], watched = [], timer, paused = false;
function update() {
  if (paused || !records.length) return;
  const time = Date.now(), positions = new Float32Array(records.length * 3), next = new Float32Array(records.length * 3), valid = new Uint8Array(records.length);
  satellites.forEach((satellite, i) => {
    const a = satellitePoint(satellite, time), b = satellitePoint(satellite, time + 2000);
    if (a && b) { positions.set(a, i * 3); next.set(b, i * 3); valid[i] = 1; }
  });
  const tracks = watched.flatMap(index => {
    const points = valid[index] && trajectory(satellites[index], records[index], time);
    return points ? [{ index, points }] : [];
  });
  postMessage({ time, positions, next, valid, tracks }, [positions.buffer, next.buffer, valid.buffer]);
}
onmessage = ({ data }) => {
  if (data.type === 'init') { records = data.records; satellites = makeSatellites(records); watched = []; clearInterval(timer); timer = setInterval(update, 2000); }
  if (data.type === 'watch') watched = [...new Set(data.indices)].filter(index => Number.isInteger(index) && index >= 0 && index < records.length).slice(-27);
  if (data.type === 'pause') paused = !!data.value;
  update();
};
