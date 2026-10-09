// Mean J2000 elements provide a coherent visual model, not precision ephemerides.
export const orbitalElements = [
  { id:'mercury', a:.387, e:.2056, i:7.005, node:48.33, peri:77.46, mean:252.25, period:.240846 },
  { id:'venus', a:.723, e:.0068, i:3.394, node:76.68, peri:131.60, mean:181.98, period:.615198 },
  { id:'earth', a:1, e:.0167, i:0, node:0, peri:102.94, mean:100.46, period:1 },
  { id:'mars', a:1.524, e:.0934, i:1.85, node:49.56, peri:336.06, mean:355.45, period:1.8808 },
  { id:'jupiter', a:5.203, e:.0484, i:1.304, node:100.46, peri:14.33, mean:34.40, period:11.862 },
  { id:'saturn', a:9.537, e:.0542, i:2.485, node:113.67, peri:93.06, mean:49.94, period:29.457 },
  { id:'uranus', a:19.19, e:.0472, i:.773, node:74.01, peri:173.0, mean:313.23, period:84.02 },
  { id:'neptune', a:30.07, e:.0086, i:1.77, node:131.78, peri:48.12, mean:304.88, period:164.8 },
  { id:'pluto', a:39.48, e:.2488, i:17.16, node:110.30, peri:224.07, mean:238.96, period:247.9 },
];

const rad = Math.PI / 180;
export const visualRadius = au => Math.pow(au, .55) * 18;

export function orbitPosition(element, decimalYear, flatten = false) {
  let anomaly = (element.mean + (decimalYear - 2000) / element.period * 360 - element.peri) * rad;
  anomaly = ((anomaly % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let eccentric = anomaly;
  for (let n=0;n<5;n++) eccentric -= (eccentric - element.e * Math.sin(eccentric) - anomaly) / (1 - element.e * Math.cos(eccentric));
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + element.e) * Math.sin(eccentric/2), Math.sqrt(1 - element.e) * Math.cos(eccentric/2));
  const distance = visualRadius(element.a) * (1 - element.e * Math.cos(eccentric));
  const argument = trueAnomaly + (element.peri - element.node) * rad;
  const ascending = element.node * rad;
  const incline = flatten ? 0 : element.i * rad;
  const x = distance * (Math.cos(ascending) * Math.cos(argument) - Math.sin(ascending) * Math.sin(argument) * Math.cos(incline));
  const z = distance * (Math.sin(ascending) * Math.cos(argument) + Math.cos(ascending) * Math.sin(argument) * Math.cos(incline));
  const y = flatten ? 0 : distance * Math.sin(argument) * Math.sin(incline);
  return [x,y,z];
}
