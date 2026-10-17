import { json2satrec, propagate, gstime, eciToEcf } from 'satellite.js';
import { EARTH_KM, ecefCoordinates, surface } from '../solar/earth/math.js';

export function readOrbitRecords(value) {
  if (!Array.isArray(value) || !value.length || value.length > 50000) throw new Error('需要 1–50,000 条 GP JSON 记录。');
  const ids = new Set();
  return value.map(record => {
    const id = Number(record.NORAD_CAT_ID);
    const finite = ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'];
    if (!Number.isSafeInteger(id) || id < 1 || ids.has(id) || typeof record.EPOCH !== 'string' || !Number.isFinite(Date.parse(record.EPOCH.endsWith('Z') ? record.EPOCH : record.EPOCH + 'Z')) ||
      finite.some(key => record[key] == null || record[key] === '' || !Number.isFinite(Number(record[key]))) ||
      Number(record.MEAN_MOTION) <= 0 || Number(record.MEAN_MOTION) > 20 || Number(record.ECCENTRICITY) < 0 || Number(record.ECCENTRICITY) >= 1 || Number(record.INCLINATION) < 0 || Number(record.INCLINATION) > 180 || ['BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'].some(key => record[key] != null && !Number.isFinite(Number(record[key])))) throw new Error('GP 记录存在无效数值、历元或重复 NORAD 编号。');
    ids.add(id);
    return { BSTAR: 0, MEAN_MOTION_DOT: 0, MEAN_MOTION_DDOT: 0, ...record, OBJECT_NAME: String(record.OBJECT_NAME || `NORAD ${id}`).slice(0,120) };
  });
}

export function makeSatellites(records) {
  return records.map(record => { try { return json2satrec(record); } catch { return null; } });
}

export function satellitePoint(satellite, time) {
  if (!satellite) return null;
  const date = new Date(time), result = propagate(satellite, date);
  if (!result?.position || satellite.error) return null;
  const fixed = eciToEcf(result.position, gstime(date));
  const vector = [fixed.x / EARTH_KM, fixed.z / EARTH_KM, -fixed.y / EARTH_KM];
  if (!vector.every(Number.isFinite) || Math.hypot(...vector) < 1) return null;
  const geo = ecefCoordinates(vector);
  return surface(geo.latitude, geo.longitude, 1 + geo.altitude / EARTH_KM);
}

export function trajectory(satellite, record, time) {
  const period = 86400000 / Number(record.MEAN_MOTION), points = [];
  for (let i = 0; i <= 240; i++) {
    const point = satellitePoint(satellite, time + (i / 240 - .5) * period);
    if (!point) return null;
    points.push(...point);
  }
  return points;
}

export function nearestTarget(targets, x, y, radius = 18) {
  let best = null, distance = radius;
  for (const target of targets) {
    const next = Math.hypot(x - target.x, y - target.y);
    if (next < distance) { best = target; distance = next; }
  }
  return best;
}
