import { missions } from './data.js';
import { orbitalElements, orbitPosition } from './orbitalModel.js';

// Mission markers are explicitly archival placement, never live ephemerides.
const byId = Object.fromEntries(orbitalElements.map((item,index)=>[item.id,{...item,index}]));
const mapSystem = system => ({moon:'earth',sun:'mercury',belt:'jupiter',deep:'pluto'})[system] || system;

self.onmessage = event => {
  if(event.data?.type!=='compute')return;
  const {year,view,requestId}=event.data;
  const decimalYear=view==='live' ? 2000+(Date.now()-Date.UTC(2000,0,1))/31557600000 : year;
  const side=view==='side';
  const planets = new Float32Array(orbitalElements.length*3);
  const missionPositions = new Float32Array(missions.length*3);
  orbitalElements.forEach((element,index)=>planets.set(orbitPosition(element,decimalYear,side),index*3));
  missions.forEach((mission,index)=>{
    const target=byId[mapSystem(mission.target)]||byId.earth;
    const center=orbitPosition(target,decimalYear,side);
    const seed=(index*1619+mission.id.length*43)%997;
    const angle=seed/997*Math.PI*2;
    const radius=mission.target==='deep'?18+(index%7)*3:mission.target==='belt'?12+(index%5)*2:4+(index%11)*.53;
    missionPositions.set([center[0]+Math.cos(angle)*radius,side?0:center[1]+Math.sin(angle*3)*radius*.08,center[2]+Math.sin(angle)*radius],index*3);
  });
  self.postMessage({requestId,year:decimalYear,planetPositions:planets.buffer,missionPositions:missionPositions.buffer},[planets.buffer,missionPositions.buffer]);
};
