import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { missions, planets, missionKinds } from './data.js';
import { orbitalElements, orbitPosition, visualRadius } from './orbitalModel.js';

const textureNames={mercury:'mercury',venus:'venus_atmosphere',earth:'earth_daymap',mars:'mars',jupiter:'jupiter',saturn:'saturn',uranus:'uranus',neptune:'neptune',sun:'sun'};
const radii={mercury:.78,venus:1.2,earth:1.35,mars:1.04,jupiter:4.2,saturn:3.7,uranus:2.35,neptune:2.3,pluto:.6};
const moonNames={earth:['MOON'],mars:['PHOBOS','DEIMOS'],jupiter:['IO','EUROPA','GANYMEDE','CALLISTO'],saturn:['TITAN','ENCELADUS','RHEA','IAPETUS'],uranus:['TITANIA','OBERON'],neptune:['TRITON','NEREID'],pluto:['CHARON']};
const minorBodies=[{name:'1P / HALLEY',a:17.8,e:.967,i:.27,phase:.13},{name:'67P / CHURYUMOV',a:3.46,e:.64,i:.12,phase:.56},{name:'2P / ENCKE',a:2.21,e:.85,i:.08,phase:.84},{name:'CERES',a:2.77,e:.08,i:.1,phase:.29},{name:'VESTA',a:2.36,e:.09,i:.12,phase:.71}];
const seeded=(seed)=>{let n=Math.sin(seed*127.1+78.233)*43758.5453;return n-Math.floor(n)};

function pointCloud(count, makePoint, color, size, opacity=1){
  const positions=new Float32Array(count*3);
  for(let i=0;i<count;i++)positions.set(makePoint(i),i*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  return new THREE.Points(geometry,new THREE.PointsMaterial({color,size,transparent:true,opacity,depthWrite:false,sizeAttenuation:true}));
}

function orbitLine(radius,eccentricity,inclination,color,opacity=.18){
  const points=[];
  for(let i=0;i<=180;i++){const angle=i/180*Math.PI*2;const distance=radius*(1-eccentricity*eccentricity)/(1+eccentricity*Math.cos(angle));points.push(new THREE.Vector3(Math.cos(angle)*distance,Math.sin(angle)*Math.sin(inclination)*distance,Math.sin(angle)*Math.cos(inclination)*distance));}
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
}

function planetaryTrack(element,color){
  const points=[];
  for(let i=0;i<240;i++)points.push(new THREE.Vector3(...orbitPosition(element,2000+element.period*i/240)));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false}));
}

function glowTexture(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,3,64,64,64);
  gradient.addColorStop(0,'#fff4cc');gradient.addColorStop(.12,'#f7d5a0b0');gradient.addColorStop(.35,'#d3904450');gradient.addColorStop(1,'#7b421000');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}

export default function SolarScene({year,view,selected,missionGroup,kind,body,hideOrbits,hideArtificial,hideNatural,nearby,autoOrbit,geoLabels,lang,onSelect,onReady,onProgress}){
  const hostRef=useRef(null),apiRef=useRef(null),selectedRef=useRef(selected),onSelectRef=useRef(onSelect);
  selectedRef.current=selected;onSelectRef.current=onSelect;

  useEffect(()=>{
    const host=hostRef.current;if(!host)return undefined;
    let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{host.textContent='此浏览器无法启动 WebGL 场景。请启用硬件加速后刷新。';return undefined;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.setSize(host.clientWidth,host.clientHeight);renderer.setClearColor(0x03060b);renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x03060b);
    const camera=new THREE.PerspectiveCamera(46,host.clientWidth/host.clientHeight,.1,800);camera.position.set(0,72,95);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.rotateSpeed=.62;controls.zoomSpeed=.68;controls.panSpeed=.5;controls.minDistance=8;controls.maxDistance=360;controls.zoomToCursor=true;
    const ambient=new THREE.AmbientLight(0x8995b0,1.25);scene.add(ambient);
    const sunlight=new THREE.PointLight(0xffdfab,1200,280,1.3);scene.add(sunlight);
    const starGroup=new THREE.Group();scene.add(starGroup);
    const stars=pointCloud(5200,i=>{const angle=seeded(i+5)*Math.PI*2,u=seeded(i+101)*2-1,r=220+seeded(i+202)*170;return [Math.cos(angle)*Math.sqrt(1-u*u)*r,u*r,Math.sin(angle)*Math.sqrt(1-u*u)*r]},0xaec3d5,.65,.74);starGroup.add(stars);
    const milkyWay=pointCloud(3600,i=>{const angle=seeded(i+400)*Math.PI*2,r=150+seeded(i+600)*85;return [Math.cos(angle)*r,(seeded(i+800)-.5)*46,Math.sin(angle)*r]},0x708dae,.53,.42);starGroup.add(milkyWay);
    const dustGroup=new THREE.Group();scene.add(dustGroup);
    const belt=pointCloud(9000,i=>{const angle=seeded(i+1200)*Math.PI*2,r=30+seeded(i+2200)*8;return [Math.cos(angle)*r,(seeded(i+3200)-.5)*2.4,Math.sin(angle)*r]},0x738da4,.33,.54);dustGroup.add(belt);
    const kuiper=pointCloud(5200,i=>{const angle=seeded(i+4500)*Math.PI*2,r=123+seeded(i+6500)*54;return [Math.cos(angle)*r,(seeded(i+7500)-.5)*10,Math.sin(angle)*r]},0x60819d,.34,.42);dustGroup.add(kuiper);
    const orbitGroup=new THREE.Group();scene.add(orbitGroup);
    const minorNodes=minorBodies.map(item=>{const orbit=orbitLine(visualRadius(item.a),item.e,item.i,0x68849c,.2);orbitGroup.add(orbit);const marker=new THREE.Mesh(new THREE.SphereGeometry(item.name==='CERES'?0.42:0.26,10,8),new THREE.MeshBasicMaterial({color:0xb7a88e}));scene.add(marker);return {...item,orbit,marker};});
    const planetNodes=new Map(),planetMeshes=[];
    const loadingManager=new THREE.LoadingManager();
    const reportProgress=(loaded,total,workerReady)=>onProgress?.({loaded,total,workerReady});
    let textureLoaded=0,textureTotal=9,workerReady=false;
    loadingManager.onProgress=(_url,loaded,total)=>{textureLoaded=loaded;textureTotal=total;reportProgress(textureLoaded,textureTotal,workerReady)};
    loadingManager.onError=()=>reportProgress(textureLoaded,textureTotal,workerReady);
    const textureLoader=new THREE.TextureLoader(loadingManager);
    const sunMap=textureLoader.load(`${import.meta.env.BASE_URL}solar/textures/sun.jpg`);sunMap.colorSpace=THREE.SRGBColorSpace;
    const sun=new THREE.Mesh(new THREE.SphereGeometry(3.35,48,32),new THREE.MeshBasicMaterial({map:sunMap,color:0xffe5b6}));sun.userData={type:'sun'};scene.add(sun);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:0xffd49b,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(29,29,1);scene.add(glow);
    for(const planet of planets){
      const radius=radii[planet.id]||1;
      const group=new THREE.Group();scene.add(group);
      const mapName=textureNames[planet.id];
      const material=new THREE.MeshStandardMaterial({color:planet.color,roughness:.95,metalness:0});
      if(mapName){const map=textureLoader.load(`${import.meta.env.BASE_URL}solar/textures/${mapName}.jpg`);map.colorSpace=THREE.SRGBColorSpace;material.map=map;material.color.set(0xffffff);}
      const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),material);sphere.userData={type:'planet',id:planet.id};group.add(sphere);
      const hitTarget=new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius*1.55,1.9),12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hitTarget.userData={type:'planet',id:planet.id};group.add(hitTarget);planetMeshes.push(hitTarget);
      if(planet.id==='saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.36,radius*2.15,96),new THREE.MeshBasicMaterial({color:0xcbb991,side:THREE.DoubleSide,transparent:true,opacity:.68,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.rotation.z=.22;group.add(ring);}
      const orbit=planetaryTrack(orbitalElements.find(item=>item.id===planet.id),planet.id==='earth'?0x8197a9:0x6d7482);orbitGroup.add(orbit);
      const moonOrbits=new THREE.Group();group.add(moonOrbits);for(let i=0;i<(planet.id==='earth'?3:planet.id==='jupiter'||planet.id==='saturn'?4:2);i++){const moonOrbit=orbitLine(radius*1.7+i*.85,.04,.12+i*.08,0x758ca0,.26);moonOrbits.add(moonOrbit);}
      const moonNodes=(moonNames[planet.id]||[]).map((name,index)=>{const marker=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.12,radius*.085),10,8),new THREE.MeshBasicMaterial({color:0xb9b9ae}));group.add(marker);return {name,index,marker,distance:radius*1.7+index*.85};});
      const geoGrid=new THREE.Group();group.add(geoGrid);if(planet.id==='earth'){for(let meridian=0;meridian<4;meridian++){const points=[];for(let n=0;n<=96;n++){const angle=n/96*Math.PI*2,rotation=meridian*Math.PI/4;points.push(new THREE.Vector3(Math.sin(angle)*Math.cos(rotation)*radius*1.03,Math.cos(angle)*radius*1.03,Math.sin(angle)*Math.sin(rotation)*radius*1.03));}geoGrid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xc6d7e4,transparent:true,opacity:.55,depthWrite:false})));}geoGrid.add(orbitLine(radius*1.03,0,0,0xc6d7e4,.55));}planetNodes.set(planet.id,{group,sphere,orbit,moonOrbits,moonNodes,geoGrid});
    }
    const missionGeometry=new THREE.SphereGeometry(.16,7,6),missionMaterial=new THREE.MeshBasicMaterial({color:0xd4af7b});
    const missionMesh=new THREE.InstancedMesh(missionGeometry,missionMaterial,missions.length);missionMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);missionMesh.userData={type:'missions'};scene.add(missionMesh);
    const dummy=new THREE.Object3D(),hidden=new THREE.Matrix4().makeScale(0,0,0);for(let i=0;i<missions.length;i++)missionMesh.setMatrixAt(i,hidden);missionMesh.instanceMatrix.needsUpdate=true;
    const labelLayer=document.createElement('div');labelLayer.className='solar-scene-labels';host.appendChild(labelLayer);
    const labels=new Map();for(const planet of planets){const label=document.createElement('span');label.className='solar-scene-label solar-scene-label-planet';label.innerHTML=`${planet.en}<small>${planet.zh}</small>`;labelLayer.appendChild(label);labels.set(planet.id,label);}
    const missionLabels=[];const featuredNames=['Voyager 1','Voyager 2','Pioneer 10','Cassini–Huygens','New Horizons','Europa Clipper','Hayabusa2','OSIRIS-REx','Galileo','Dawn','Rosetta','Juno'];
    const labelMissions=featuredNames.map(name=>({mission:missions.find(item=>item.name.toLowerCase()===name.toLowerCase()),index:missions.findIndex(item=>item.name.toLowerCase()===name.toLowerCase())})).filter(({index})=>index>=0);
    for(const {mission,index} of labelMissions){const label=document.createElement('span');label.className='solar-scene-label solar-scene-label-mission';label.textContent=`${mission.name} · ${mission.year}`;labelLayer.appendChild(label);missionLabels.push({label,index});}
    const minorLabels=minorNodes.map(node=>{const label=document.createElement('span');label.className='solar-scene-label solar-scene-label-minor';label.textContent=node.name;labelLayer.appendChild(label);return {node,label};});
    const moonLabels=[];planetNodes.forEach((node,id)=>node.moonNodes.forEach(moon=>{const label=document.createElement('span');label.className='solar-scene-label solar-scene-label-moon';label.textContent=moon.name;labelLayer.appendChild(label);moonLabels.push({id,node,moon,label})}));
    const reticle=document.createElement('div');reticle.className='solar-scene-reticle';host.appendChild(reticle);
    const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let hover=null,mouseX=0,mouseY=0,visible=true,frame=0,requestId=0;
    const worker=new Worker(new URL('./orbits.worker.js',import.meta.url),{type:'module'});
    const planetPositions=new Float32Array(planets.length*3),missionPositions=new Float32Array(missions.length*3);
    const config={year,view,selected,missionGroup,kind,body,hideOrbits,hideArtificial,hideNatural,nearby,autoOrbit,geoLabels,lang};
    const filterMission=mission=>mission.year<=config.year&&(config.missionGroup==='all'||missionKinds.find(group=>group.id===config.missionGroup)?.kinds.includes(mission.kind))&&(!config.hideArtificial||!['satellite','constellation','station','capsule'].includes(mission.kind))&&(config.body==='all'||mission.target===config.body)&&config.kind!=='planets'&&config.nearby;
    const refresh=()=>{
      orbitGroup.scale.y=config.view==='side'?0:1;
      minorNodes.forEach(node=>{node.orbit.visible=!config.hideOrbits;node.marker.visible=config.body==='all'});
      planetNodes.forEach((node,id)=>{node.orbit.visible=!config.hideOrbits;node.moonOrbits.visible=!config.hideNatural&&!config.hideOrbits;node.moonNodes.forEach(moon=>moon.marker.visible=!config.hideNatural);node.geoGrid.visible=config.geoLabels;node.group.visible=config.body==='all'||config.body===id;});
      missionMesh.visible=config.kind!=='planets'&&config.nearby;
      for(let i=0;i<missions.length;i++){
        if(!filterMission(missions[i])){missionMesh.setMatrixAt(i,hidden);continue;}
        dummy.position.fromArray(missionPositions,i*3);dummy.scale.setScalar(selectedRef.current?.type==='mission'&&selectedRef.current.id===missions[i].id?2:1);dummy.updateMatrix();missionMesh.setMatrixAt(i,dummy.matrix);
      }
      missionMesh.instanceMatrix.needsUpdate=true;missionMesh.computeBoundingSphere();
    };
    worker.onmessage=event=>{if(event.data.requestId<requestId)return;planetPositions.set(new Float32Array(event.data.planetPositions));missionPositions.set(new Float32Array(event.data.missionPositions));planets.forEach((planet,index)=>planetNodes.get(planet.id)?.group.position.fromArray(planetPositions,index*3));workerReady=true;reportProgress(textureLoaded,textureTotal,workerReady);refresh();if(selectedRef.current)focus(selectedRef.current);};
    const compute=()=>worker.postMessage({type:'compute',year:config.year,view:config.view,requestId:++requestId});compute();
    const liveTimer=window.setInterval(()=>{if(config.view==='live'&&!document.hidden)compute()},60000);
    const project=(position,label,offset=0)=>{const p=position.clone().project(camera);const inView=p.z>-1&&p.z<1&&Math.abs(p.x)<1.05&&Math.abs(p.y)<1.05;label.style.display=inView?'block':'none';if(inView)label.style.transform=`translate(${Math.round((p.x*.5+.5)*host.clientWidth+offset)}px,${Math.round((-p.y*.5+.5)*host.clientHeight)}px)`;};
    let tween=null;const positionBuffer=new THREE.Vector3();
    const focus=item=>{let target;if(item.type==='planet')target=planetNodes.get(item.id)?.group.position.clone();else{const index=missions.findIndex(m=>m.id===item.id);if(index>=0)target=new THREE.Vector3().fromArray(missionPositions,index*3);}if(!target)return;
      const direction=camera.position.clone().sub(controls.target).normalize();const distance=item.type==='planet'?Math.max(10,(radii[item.id]||1)*5):13;
      tween={target,camera:target.clone().add(direction.multiplyScalar(distance))};};
    const reset=()=>{tween={target:new THREE.Vector3(),camera:new THREE.Vector3(0,72,95)};};
    const zoom=factor=>{const direction=camera.position.clone().sub(controls.target);direction.multiplyScalar(factor);const next=direction.length();direction.setLength(THREE.MathUtils.clamp(next,controls.minDistance,controls.maxDistance));tween={target:controls.target.clone(),camera:controls.target.clone().add(direction)};};
    const setView=viewName=>{const distance=camera.position.distanceTo(controls.target);const position=viewName==='side'?new THREE.Vector3(0,distance*.1,distance*.99):viewName==='live'?new THREE.Vector3(0,distance*.82,distance*.57):new THREE.Vector3(0,distance*.6,distance*.8);position.setLength(distance);tween={target:controls.target.clone(),camera:controls.target.clone().add(position)};};
    const pointerMove=event=>{const rect=renderer.domElement.getBoundingClientRect();mouse.x=(event.clientX-rect.left)/rect.width*2-1;mouse.y=-(event.clientY-rect.top)/rect.height*2+1;mouseX=mouse.x;mouseY=mouse.y;reticle.style.left=`${event.clientX-rect.left}px`;reticle.style.top=`${event.clientY-rect.top}px`;reticle.style.opacity='1';raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects([...planetMeshes,missionMesh],false);const first=hits.find(hit=>hit.object.visible&&(!hit.object.isInstancedMesh||filterMission(missions[hit.instanceId])));hover=first?first.object===missionMesh?{type:'mission',id:missions[first.instanceId].id}:{type:'planet',id:first.object.userData.id}:null;renderer.domElement.style.cursor=hover?'pointer':'grab';reticle.classList.toggle('is-target',Boolean(hover));};
    const pointerLeave=()=>{hover=null;reticle.style.opacity='0';};
    let down=null;const pointerDown=event=>{down={x:event.clientX,y:event.clientY}};
    const pointerUp=event=>{if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<5&&hover){onSelectRef.current?.(hover);focus(hover);}down=null;};
    renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerleave',pointerLeave);renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
    const resize=new ResizeObserver(()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);});resize.observe(host);
    const animate=()=>{if(!visible)return;frame=requestAnimationFrame(animate);controls.autoRotate=Boolean(config.autoOrbit);controls.autoRotateSpeed=.25;controls.update();
      if(tween){camera.position.lerp(tween.camera,.085);controls.target.lerp(tween.target,.085);if(camera.position.distanceTo(tween.camera)<.08&&controls.target.distanceTo(tween.target)<.08)tween=null;}
      starGroup.rotation.y=THREE.MathUtils.lerp(starGroup.rotation.y,mouseX*.12,.025);starGroup.rotation.x=THREE.MathUtils.lerp(starGroup.rotation.x,mouseY*.07,.025);starGroup.position.x=THREE.MathUtils.lerp(starGroup.position.x,mouseX*5,.025);starGroup.position.y=THREE.MathUtils.lerp(starGroup.position.y,mouseY*3,.025);dustGroup.rotation.y+=.00004;sun.rotation.y+=.00035;
      planetNodes.forEach(({sphere,moonNodes})=>{sphere.rotation.y+=.00045;moonNodes.forEach(moon=>{const angle=frame*.00025/(moon.index+1)+moon.index*1.7;moon.marker.position.set(Math.cos(angle)*moon.distance,Math.sin(angle*1.4)*moon.distance*.08,Math.sin(angle)*moon.distance)})});
      minorNodes.forEach(node=>{const angle=(config.year-1957)*.031+node.phase*Math.PI*2,radius=visualRadius(node.a)*(1-node.e*node.e)/(1+node.e*Math.cos(angle));node.marker.position.set(Math.cos(angle)*radius,config.view==='side'?0:Math.sin(angle)*Math.sin(node.i)*radius,Math.sin(angle)*Math.cos(node.i)*radius)});
      const occupied=[];
      const placeLabel=(position,label,offset,width,height)=>{project(position,label,offset);if(label.style.display==='none')return;const projectedX=parseFloat(label.style.transform.match(/translate\(([-\d.]+)px/)?.[1]||'0'),projectedY=parseFloat(label.style.transform.match(/,([\d.-]+)px/)?.[1]||'0');const x=THREE.MathUtils.clamp(projectedX,8,Math.max(8,host.clientWidth-width-8)),y=THREE.MathUtils.clamp(projectedY,8,Math.max(8,host.clientHeight-height-8));const collision=occupied.some(box=>x<box.x+box.w&&x+width>box.x&&y<box.y+box.h&&y+height>box.y);if(collision){label.style.display='none';return;}label.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;occupied.push({x,y,w:width,h:height});};
      const priority=[selectedRef.current?.type==='planet'?selectedRef.current.id:null,'earth','jupiter','saturn','mars','venus','mercury','uranus','neptune','pluto'].filter((id,index,array)=>id&&array.indexOf(id)===index);
      priority.forEach(id=>{const node=planetNodes.get(id),label=labels.get(id);placeLabel(node.group.position,label,10,90,30);label.style.visibility=config.body==='all'||config.body===id?'visible':'hidden';});
      for(const {id,node,moon,label} of moonLabels){if(moon.marker.visible&&selectedRef.current?.type==='planet'&&selectedRef.current.id===id){const world=node.group.localToWorld(moon.marker.position.clone());placeLabel(world,label,6,90,16)}else label.style.display='none';}
      for(const {node,label} of minorLabels){if(node.marker.visible){placeLabel(node.marker.position,label,5,110,16)}else label.style.display='none';}
      for(const {label,index} of missionLabels){if(filterMission(missions[index])){positionBuffer.fromArray(missionPositions,index*3);placeLabel(positionBuffer,label,5,145,19);}else label.style.display='none';}
      renderer.render(scene,camera);
    };animate();
    const visibility=()=>{visible=!document.hidden;if(visible)animate();else cancelAnimationFrame(frame)};document.addEventListener('visibilitychange',visibility);
    const api={focus,reset,zoom,setView,setData(next){const previousYear=config.year,previousView=config.view,previousLang=config.lang;Object.assign(config,next);if(previousYear!==config.year||previousView!==config.view)compute();if(previousLang!==config.lang)planets.forEach(planet=>{labels.get(planet.id).innerHTML=config.lang==='zh'?`${planet.en}<small>${planet.zh}</small>`:`${planet.zh}<small>${planet.en}</small>`});refresh();}};apiRef.current=api;onReady?.(api);
    return()=>{visible=false;cancelAnimationFrame(frame);window.clearInterval(liveTimer);resize.disconnect();document.removeEventListener('visibilitychange',visibility);worker.terminate();controls.dispose();renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerleave',pointerLeave);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);const release=material=>{material.map?.dispose();material.dispose()};scene.traverse(object=>{object.geometry?.dispose();if(Array.isArray(object.material))object.material.forEach(release);else if(object.material)release(object.material)});renderer.dispose();host.replaceChildren();apiRef.current=null;};
  },[]);

  useEffect(()=>{apiRef.current?.setData({year,view,selected,missionGroup,kind,body,hideOrbits,hideArtificial,hideNatural,nearby,autoOrbit,geoLabels,lang});},[year,view,selected,missionGroup,kind,body,hideOrbits,hideArtificial,hideNatural,nearby,autoOrbit,geoLabels,lang]);
  return <div className="solar-scene" ref={hostRef} aria-label="可旋转和缩放的三维太阳系场景" />;
}
