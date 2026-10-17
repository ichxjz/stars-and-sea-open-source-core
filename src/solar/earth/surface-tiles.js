import * as THREE from 'three';
import {coordinates,surface,tileAt,tileLatitude} from './math.js';
export function tileGeometry(z,x,y) {
  const n=2**z, size=Math.max(2,Math.ceil(360/n/.5)), positions=[],uv=[],indices=[];
  for(let row=0;row<=size;row++)for(let col=0;col<=size;col++) {
    // Separate parent/detail shells beyond Float32 rounding at street scale.
    // Polygon offset alone cannot resolve sub-metre equal-radius tile layers.
    positions.push(...surface(tileLatitude(y+row/size,n),(x+col/size)/n*360-180,1.000025+z*1e-7));uv.push(col/size,1-row/size);
  }
  for(let row=0;row<size;row++)for(let col=0;col<size;col++) {const a=row*(size+1)+col,b=a+size+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export class SurfaceTiles {
  constructor(scene,status,{renderer=null,maxZoom=19,concurrency=6}={}) {
    this.group=new THREE.Group();scene.add(this.group);this.cache=new Map();this.queue=[];this.retainedPlans=new Map();
    this.active=new Map();this.wanted=new Set();this.loading=0;this.mode='map';this.version=0;
    this.status=status;this.failed=0;this.renderer=renderer;this.maxZoom=maxZoom;this.concurrency=Math.max(1,Math.min(6,concurrency));this.bufferSize=new THREE.Vector2();this.ray=new THREE.Ray();this.sphere=new THREE.Sphere(new THREE.Vector3(),1);
  }
  change(mode) {if(this.mode===mode)return;this.version++;this.cancelPending();this.mode=mode;for(const entry of this.cache.values())if(entry.mesh)entry.mesh.visible=false;this.failed=0;}
  disposeMesh(mesh) {
    this.group.remove(mesh);mesh.geometry.dispose();
    const texture=mesh.material.map;texture?.dispose();texture?.image?.close?.();mesh.material.dispose();
  }
  cancel(task,failed=false) {
    if(this.active.get(task.key)!==task)return;
    this.active.delete(task.key);this.loading=this.active.size;clearTimeout(task.timer);task.controller.abort();
    const entry=this.cache.get(task.key);
    if(entry?.task===task){
      if(failed){this.failed++;this.cache.set(task.key,{last:performance.now(),retryAt:performance.now()+30000});}
      else this.cache.delete(task.key);
    }
  }
  cancelPending() {
    this.queue=[];this.wanted.clear();
    for(const task of [...this.active.values()])this.cancel(task);
    for(const [key,entry] of this.cache)if(!entry.mesh)this.cache.delete(key);
  }
  clear() {
    this.version++;this.cancelPending();
    for(const {mesh} of this.cache.values())if(mesh)this.disposeMesh(mesh);
    this.cache.clear();this.retainedPlans.clear();this.failed=0;
  }
  drawingSize(camera) {
    if(this.renderer?.getDrawingBufferSize){this.renderer.getDrawingBufferSize(this.bufferSize);return {width:Math.max(1,this.bufferSize.x),height:Math.max(1,this.bufferSize.y)};}
    const height=900;return {width:Math.max(1,Math.round(height*camera.aspect)),height};
  }
  plan(camera,target=null) {
    const size=this.drawingSize(camera),points=[],direction=new THREE.Vector3(),hit=new THREE.Vector3();
    camera.updateMatrixWorld?.();
    if(camera.getWorldDirection)camera.getWorldDirection(direction);
    else direction.copy(target||new THREE.Vector3()).sub(camera.position).normalize();
    this.ray.set(camera.position,direction);
    const focus=this.ray.intersectSphere(this.sphere,hit)?.clone()||camera.position.clone().normalize();
    const geo=coordinates(focus.toArray());
    // One raster texel should cover at most one drawing-buffer pixel. A fixed
    // seven-column rule overscales the same 256px image on large/DPR displays.
    const range=camera.position.distanceTo(focus),incidence=Math.max(.15,Math.abs(direction.dot(focus)));
    const perPixel=2*range*Math.tan(camera.fov*Math.PI/360)/size.height/incidence;
    const z=Math.max(2,Math.min(this.maxZoom,Math.ceil(Math.log2(2*Math.PI*Math.max(.03,Math.cos(geo.latitude*Math.PI/180))/(256*Math.max(1e-8,perPixel))))));
    points.push(focus);
    // Sample the actual projection, including view offsets and a panned
    // controls target. Corner-only bounds miss the limb when corners are sky.
    if(camera.projectionMatrix&&camera.matrixWorld)for(let row=0;row<=6;row++)for(let col=0;col<=6;col++){
      direction.set(col/3-1,1-row/3,.5).unproject(camera).sub(camera.position).normalize();
      this.ray.set(camera.position,direction);
      if(this.ray.intersectSphere(this.sphere,hit))points.push(hit.clone());
    }else{
      const distance=camera.position.length(),half=camera.fov*Math.PI/360;
      const angle=theta=>{if(distance*Math.sin(theta)>=1)return Math.acos(1/distance);const t=distance*Math.cos(theta)-Math.sqrt(Math.max(0,1-distance*distance*Math.sin(theta)**2));return Math.atan2(t*Math.sin(theta),distance-t*Math.cos(theta));};
      const latSpan=angle(half)*180/Math.PI,lonSpan=angle(Math.atan(Math.tan(half)*camera.aspect))*180/Math.PI/Math.max(.1,Math.cos(geo.latitude*Math.PI/180));
      for(const lat of [geo.latitude-latSpan,geo.latitude+latSpan])for(const lon of [geo.longitude-lonSpan,geo.longitude+lonSpan])points.push(new THREE.Vector3(...surface(Math.max(-85,Math.min(85,lat)),lon)));
    }
    const bounds=points.map(point=>{const p=coordinates(point.toArray());let lon=p.longitude;while(lon-geo.longitude>180)lon-=360;while(lon-geo.longitude<-180)lon+=360;return {...p,longitude:lon};});
    const tilePixels=2*Math.PI*Math.max(.03,Math.cos(geo.latitude*Math.PI/180))/(2**z)/perPixel;
    const tasks=new Map(),wanted=new Set(),detail=new Set(),fineBudget=Math.max(64,Math.min(320,(Math.ceil(size.width/Math.max(64,tilePixels))+2)*(Math.ceil(size.height/Math.max(64,tilePixels))+2)));
    const addLevel=(level,budget,coarse=false,local=false)=>{
      const n=2**level,center=tileAt(geo.latitude,geo.longitude,level),ys=bounds.map(p=>tileAt(p.latitude,p.longitude,level).y),xs=bounds.map(p=>(p.longitude+180)/360*n);
      let minX=Math.floor(Math.min(...xs))-1,maxX=Math.floor(Math.max(...xs))+1,minY=Math.max(0,Math.min(...ys)-1),maxY=Math.min(n-1,Math.max(...ys)+1);
      if(local){minX=center.x-1;maxX=center.x+1;minY=Math.max(0,center.y-1);maxY=Math.min(n-1,center.y+1);}
      // Grazing horizon samples can span many far-away texels. Keep the centre
      // at full resolution; the broader parent layer covers those edges.
      const radius=Math.ceil(Math.sqrt(budget));minX=Math.max(minX,center.x-radius);maxX=Math.min(maxX,center.x+radius);minY=Math.max(minY,center.y-radius);maxY=Math.min(maxY,center.y+radius);
      const candidates=[];
      for(let y=minY;y<=maxY;y++)for(let rawX=minX;rawX<=maxX;rawX++){
        const x=((rawX%n)+n)%n,dx=rawX-center.x,dy=y-center.y,key=`${this.mode}/${level}/${x}/${y}`;
        candidates.push({key,z:level,x,y,mode:this.mode,version:this.version,distance:Math.hypot(dx,dy),coarse});
      }
      candidates.sort((a,b)=>a.distance-b.distance);
      for(const task of candidates.slice(0,budget)){
        if(tasks.has(task.key))continue;
        task.priority=coarse?.1+task.distance*.01:local?1+task.distance*.01:2+task.distance;
        wanted.add(task.key);tasks.set(task.key,task);if(level===z)detail.add(task.key);
      }
    };
    addLevel(z,fineBudget);
    if(z>2)addLevel(Math.max(2,z-3),32,true);
    if(z>3)addLevel(z-1,9,false,true);
    return {z,geo,size,perPixel,wanted,detail,tasks};
  }
  update(camera,target=null) {
    const plan=this.plan(camera,target),{z,wanted,detail,tasks}=plan,now=performance.now();this.lastPlan=plan;this.wanted=wanted;
    this.retainedPlans.set(this.mode,new Set(wanted));
    // KK_TILE_PREEMPTION: old zoom requests must not occupy the three slots
    // while the camera is already looking at a new level or another region.
    for(const task of [...this.active.values()])if(!wanted.has(task.key))this.cancel(task);
    for(const [key,entry] of this.cache)if(!entry.mesh&&!wanted.has(key))this.cache.delete(key);
    this.queue=[];
    for(const [key,task] of tasks){
      const entry=this.cache.get(key);
      if(entry?.mesh){entry.last=now;continue;}
      if(this.active.has(key)||entry?.retryAt>now)continue;
      this.cache.set(key,{last:now,pending:true});this.queue.push(task);
    }
    this.queue.sort((a,b)=>a.priority-b.priority);
    const ready=[...detail].filter(key=>this.cache.get(key)?.mesh).length;
    for(const [key,entry] of this.cache)if(entry.mesh){entry.mesh.visible=key.startsWith(this.mode+'/')&&(wanted.has(key)||ready<detail.size*.9);entry.mesh.renderOrder=entry.z||Number(key.split('/')[1]);if(entry.mesh.material.userData.rasterDetail)entry.mesh.material.userData.rasterDetail.value=(entry.z||Number(key.split('/')[1]))>=z-1?1:0;}
    // A complete high-DPR view can need almost 360 tiles. Preserve the last
    // requested view of each style before counting historical tiles: new
    // pending entries must not evict the map just because imagery is loading.
    const retained=new Set([...this.retainedPlans.values()].flatMap(keys=>[...keys]));
    const cacheLimit=Math.max(420,retained.size+128),cacheTarget=Math.max(350,retained.size+64);
    if(this.cache.size>cacheLimit)for(const [key,entry] of [...this.cache].sort((a,b)=>a[1].last-b[1].last)){
      if(this.cache.size<=cacheTarget)break;if(!retained.has(key)&&entry.mesh){this.disposeMesh(entry.mesh);this.cache.delete(key);}
    }
    this.zoom=z;this.status.textContent=`${this.mode==='map'?'行政地图':'卫星影像'} · 高清层级 ${z}${this.failed?' · 部分图块重试中':''}`;this.pump();
  }
  current(task) {return task.version===this.version&&this.wanted.has(task.key)&&this.active.get(task.key)===task&&!task.controller.signal.aborted;}
  pump() {
    while(this.active.size<this.concurrency&&this.queue.length){
      const task=this.queue.shift();if(task.version!==this.version||!this.wanted.has(task.key)||this.active.has(task.key))continue;
      task.controller=new AbortController();this.active.set(task.key,task);this.loading=this.active.size;
      this.cache.set(task.key,{last:performance.now(),pending:true,task});
      // Release the slot even if bitmap decoding outlives the aborted fetch.
      task.timer=setTimeout(()=>{this.cancel(task,true);this.pump();},8000);
      void this.load(task);
    }
  }
  async load(task) {
    let bitmap=null,texture=null;
    try{
      const url=task.mode==='map'?`https://tile.openstreetmap.org/${task.z}/${task.x}/${task.y}.png`:`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${task.z}/${task.y}/${task.x}`;
      let response;
      try{response=await fetch(url,{signal:task.controller.signal,mode:'cors',credentials:'omit'});}
      catch(error){if(task.controller.signal.aborted||!(error instanceof TypeError))throw error;response=await fetch(`/api/earth/tiles/${task.mode}/${task.z}/${task.x}/${task.y}`,{signal:task.controller.signal});}
      if(!response.ok)throw new Error(`Map tile HTTP ${response.status}`);
      const blob=await response.blob();if(!this.current(task))return;
      // ImageBitmap ignores Texture.flipY. Flip during decode to preserve the
      // TextureLoader orientation against the existing north-to-south tile UVs.
      bitmap=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      if(!this.current(task))return;
      texture=new THREE.Texture(bitmap);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=Math.max(1,Math.min(16,this.renderer?.capabilities?.getMaxAnisotropy?.()||1));texture.needsUpdate=true;
      const material=new THREE.MeshBasicMaterial({map:texture,polygonOffset:true,polygonOffsetFactor:-task.z,polygonOffsetUnits:-task.z});
      material.userData.rasterDetail={value:task.z>=this.zoom-1?1:0};
      if(task.mode==='map')material.onBeforeCompile=shader=>{(shader.uniforms||={}).kkRasterDetail=material.userData.rasterDetail;shader.fragmentShader='uniform float kkRasterDetail;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
// Preserve semantic water/road/rail/vegetation colors from the real map.
float kkLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
diffuseColor.rgb=mix(vec3(kkLuma),diffuseColor.rgb,.82);`);};
      const mesh=new THREE.Mesh(tileGeometry(task.z,task.x,task.y),material);
      mesh.renderOrder=task.z;
      this.group.add(mesh);this.cache.set(task.key,{mesh,z:task.z,x:task.x,y:task.y,last:performance.now()});bitmap=null;texture=null;
    }catch{
      if(this.current(task)){this.failed++;this.cache.set(task.key,{last:performance.now(),retryAt:performance.now()+30000});}
    }finally{
      texture?.dispose();bitmap?.close?.();clearTimeout(task.timer);
      if(this.active.get(task.key)===task){this.active.delete(task.key);this.loading=this.active.size;}
      this.pump();
    }
  }
  dispose() {this.clear();this.group.removeFromParent();}
}
