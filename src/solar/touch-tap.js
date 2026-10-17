// A pinch or drag never becomes a tap. Delayed single selection avoids opening
// a satellite/card in the middle of a two-tap photo-style zoom gesture.
export function installTouchTap(canvas,{single=()=>{},double=()=>{},capture=()=>undefined,delaySingle=true,now=()=>performance.now()}={}){
  const pointers=new Map();let pending=null,timer,last=null;
  const cancel=()=>{clearTimeout(timer);pending=null;last=null;};
  const down=event=>{
    if(event.pointerType!=='touch')return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,moved:false});
    if(pointers.size>1){cancel();for(const point of pointers.values())point.moved=true;}
  };
  const move=event=>{const point=pointers.get(event.pointerId);if(point&&Math.hypot(event.clientX-point.x,event.clientY-point.y)>8){point.moved=true;cancel();}};
  const up=event=>{
    const point=pointers.get(event.pointerId);pointers.delete(event.pointerId);
    if(!point||point.moved||Math.hypot(event.clientX-point.x,event.clientY-point.y)>8)return;
    const position={x:event.clientX,y:event.clientY,time:now()};
    if(last&&position.time-last.time<300&&Math.hypot(position.x-last.x,position.y-last.y)<32){cancel();event.preventDefault();double(position);return;}
    last=position;
    // Freeze the identity under the finger now. A moving satellite can leave
    // this pixel while the recognizer waits to rule out a double tap.
    if(delaySingle){pending={...position,data:capture(position)};clearTimeout(timer);timer=setTimeout(()=>{if(pending){single(pending);pending=null;}},300);}
  };
  const abort=event=>{pointers.delete(event.pointerId);cancel();};
  canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',abort,true);
  return ()=>{cancel();canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',abort,true);};
}
