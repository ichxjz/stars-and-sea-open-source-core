import test from 'node:test';
import assert from 'node:assert/strict';
import { readOrbitRecords, makeSatellites, satellitePoint, trajectory, nearestTarget } from '../src/earth/orbit-model.js';
import { observationDirection } from '../src/solar/earth/math.js';

// Synthetic numerical fixture, not an observed satellite or distributed GP snapshot.
const example = { NORAD_CAT_ID: 900001, OBJECT_NAME: 'SYNTHETIC TEST ONLY', EPOCH: '2026-10-17T00:00:00', MEAN_MOTION: 15.5, ECCENTRICITY: .0001, INCLINATION: 51.6, RA_OF_ASC_NODE: 25, ARG_OF_PERICENTER: 40, MEAN_ANOMALY: 80, BSTAR: 0, MEAN_MOTION_DOT: 0, MEAN_MOTION_DDOT: 0 };
const time = Date.parse(example.EPOCH + 'Z');
test('GP validation rejects wrong shape, duplicate identity and unsafe numeric elements', () => {
  assert.equal(readOrbitRecords([example]).length, 1);
  for (const value of [[], {}, [example,example], [{...example,EPOCH:'bad'}], [{...example,ECCENTRICITY:1}], [{...example,MEAN_MOTION:0}], [{...example,INCLINATION:null}], [{...example,NORAD_CAT_ID:-1}]]) assert.throws(() => readOrbitRecords(value));
});
test('SGP4 positions move; each selected trajectory has 241 finite samples anchored at the current position', () => {
  const [satellite] = makeSatellites(readOrbitRecords([example]));
  const a = satellitePoint(satellite,time), b = satellitePoint(satellite,time+2000), track = trajectory(satellite,example,time);
  assert.ok(a.every(Number.isFinite)); assert.ok(Math.hypot(...a)>1); assert.notDeepEqual(a,b);
  assert.equal(track.length,241*3); assert.ok(track.every(Number.isFinite));
  for(let i=0;i<3;i++) assert.ok(Math.abs(track[120*3+i]-a[i])<1e-7);
});
test('point picking uses the closest physical candidate, without selecting a distant or missing point', () => {
  const points = [{index:4,x:100,y:100},{index:7,x:107,y:105}];
  assert.equal(nearestTarget(points,108,104).index,7);
  assert.equal(nearestTarget(points,150,150),null);
});
test('day, terminator and night camera directions agree with the Sun vector', () => {
  const planet=[20,3,-5], sun=planet.map(x=>-x/Math.hypot(...planet));
  for(const [side,expected] of [['day',1],['terminator',0],['night',-1]]) {
    const direction=observationDirection(planet,side);
    assert.ok(Math.abs(direction.reduce((sum,x,i)=>sum+x*sun[i],0)-expected)<1e-12);
  }
});
