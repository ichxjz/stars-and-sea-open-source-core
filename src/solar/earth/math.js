export const EARTH_KM = 6378.137;
export const MAX_WATCHED = 27;
export function observationDirection(planetPosition, side) {
  const length=Math.hypot(...planetPosition);
  if(!length||!['day','terminator','night'].includes(side))return null;
  const sun=planetPosition.map(value=>-value/length);
  if(side==='day')return sun;
  if(side==='night')return sun.map(value=>-value);
  let cross=[sun[2],0,-sun[0]];
  if(Math.hypot(...cross)<1e-6)cross=[0,-sun[2],sun[1]];
  const norm=Math.hypot(...cross);return cross.map(value=>value/norm);
}
export function coordinates(point) {
  const radius = Math.hypot(...point);
  return { latitude: Math.asin(point[1] / radius) * 180 / Math.PI, longitude: Math.atan2(-point[2], point[0]) * 180 / Math.PI, altitude: (radius - 1) * EARTH_KM };
}
export function surface(lat, lon, radius = 1) {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
  return [radius * Math.cos(a) * Math.cos(b), radius * Math.sin(a), -radius * Math.cos(a) * Math.sin(b)];
}
export function tileAt(lat, lon, zoom) {
  const n = 2 ** zoom, phi = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180;
  return { x: Math.min(n - 1, Math.max(0, Math.floor((lon + 180) / 360 * n))), y: Math.min(n - 1, Math.max(0, Math.floor((1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2 * n))) };
}
export function tileLatitude(y, n) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI; }
export function visibleAboveHorizon(camera, point) {
  // A point above the surface can remain visible slightly beyond the limb.
  const d = Math.hypot(...camera), r = Math.hypot(...point);
  const angle = Math.acos(Math.max(-1, Math.min(1, camera.reduce((sum,v,i)=>sum+v*point[i],0)/(d*r))));
  return angle < Math.acos(Math.min(1,1/d)) + Math.acos(Math.min(1,1/r));
}
export function addressLevels(address = {}) {
  const candidates = [address.country, address.state || address.region, address.city || address.municipality || address.state_district, address.county || address.district, address.town || address.suburb, address.village || address.hamlet || address.neighbourhood || address.locality];
  return [...new Set(candidates.filter(Boolean))];
}
// The SGP4 worker produces Earth-fixed Cartesian coordinates. Convert against
// the WGS84 ellipsoid before mapping onto the visual globe, so district lookup
// does not inherit the roughly 20 km geocentric-latitude error at midlatitudes.
export function ecefCoordinates(point) {
  const a=EARTH_KM,b=6356.752314245,e2=1-b*b/(a*a),horizontal=Math.hypot(point[0],point[2])*a,z=point[1]*a;
  const longitude=Math.atan2(-point[2],point[0])*180/Math.PI;
  if(horizontal<1e-8)return {latitude:z<0?-90:90,longitude,altitude:Math.abs(z)-b};
  let latitude=Math.atan2(z,horizontal*(1-e2)),normal=a;
  for(let i=0;i<6;i++){normal=a/Math.sqrt(1-e2*Math.sin(latitude)**2);latitude=Math.atan2(z+e2*normal*Math.sin(latitude),horizontal);}
  normal=a/Math.sqrt(1-e2*Math.sin(latitude)**2);
  return {latitude:latitude*180/Math.PI,longitude,altitude:horizontal/Math.cos(latitude)-normal};
}
