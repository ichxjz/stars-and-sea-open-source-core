import { lazy, Suspense, useEffect, useRef, useState } from 'react';
const EarthView = lazy(() => import('./earth/EarthView.jsx'));
import { missions, missionKinds, planets, yearMin, yearMax } from './data.js';
import SolarScene from './SolarScene.jsx';
import { orbitalElements } from './orbitalModel.js';

const planetById = Object.fromEntries(planets.map(item => [item.id, item]));
const textureNames = {mercury:'mercury',venus:'venus_atmosphere',earth:'earth_daymap',mars:'mars',jupiter:'jupiter',saturn:'saturn',uranus:'uranus',neptune:'neptune'};
const basePath = import.meta.env.BASE_URL;

function descriptionOf(selected) {
  if (!selected) return null;
  const item=selected.type==='planet'?planetById[selected.id]:missions.find(mission=>mission.id===selected.id);
  return item ? {item,type:selected.type} : null;
}

export default function SolarAtlas() {
  const sceneApiRef=useRef(null), audioRef=useRef(null);
  const [entered,setEntered]=useState(false),[year,setYear]=useState(yearMax),[playing,setPlaying]=useState(false);
  const [kind,setKind]=useState('all'),[body,setBody]=useState('all'),[view,setView]=useState('orbit'),[lang,setLang]=useState('zh');
  const [selected,setSelected]=useState(null),[panel,setPanel]=useState(''),[query,setQuery]=useState('');
  const [menu,setMenu]=useState(''),[missionGroup,setMissionGroup]=useState('all');
  const [hideOrbits,setHideOrbits]=useState(false),[hideArtificial,setHideArtificial]=useState(false),[hideNatural,setHideNatural]=useState(false);
  const [autoOrbit,setAutoOrbit]=useState(false),[nearby,setNearby]=useState(true),[geoLabels,setGeoLabels]=useState(false),[immersive,setImmersive]=useState(false);
  const [sound,setSound]=useState(false),[music,setMusic]=useState(false),[bootProgress,setBootProgress]=useState({loaded:0,total:9,workerReady:false}),[bootDelayDone,setBootDelayDone]=useState(false);
  const detail=descriptionOf(selected);
  const orbitFact=detail?.type==='planet'?orbitalElements.find(item=>item.id===detail.item.id):null;

  useEffect(()=>{
    const timer=window.setTimeout(()=>setBootDelayDone(true),750);
    return()=>window.clearTimeout(timer);
  },[]);
  useEffect(()=>{
    if(!music)return undefined;
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return undefined;
    const context=audioRef.current||new Context();audioRef.current=context;
    const gain=context.createGain();gain.gain.value=.008;gain.connect(context.destination);
    const tones=[110,164.81,220].map(frequency=>{const oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.connect(gain);oscillator.start();return oscillator});
    return()=>{tones.forEach(tone=>tone.stop());gain.disconnect()};
  },[music]);
  const playCue=()=>{
    if(!sound)return;const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    const context=audioRef.current||new Context();audioRef.current=context;
    const tone=context.createOscillator(),gain=context.createGain();tone.type='sine';tone.frequency.setValueAtTime(610,context.currentTime);tone.frequency.exponentialRampToValueAtTime(930,context.currentTime+.08);
    gain.gain.setValueAtTime(.025,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);tone.connect(gain);gain.connect(context.destination);tone.start();tone.stop(context.currentTime+.12);tone.onended=()=>gain.disconnect();
  };
  useEffect(()=>{if(!playing)return undefined;const timer=window.setInterval(()=>setYear(current=>current>=yearMax?yearMin:current+1),360);return()=>clearInterval(timer)},[playing]);
  useEffect(()=>{sceneApiRef.current?.setView(view)},[view]);
  const resetView=()=>{setSelected(null);setBody('all');sceneApiRef.current?.reset();};
  const earthFocused=entered&&selected?.type==='planet'&&selected.id==='earth';
  const changeZoom=delta=>sceneApiRef.current?.zoom(1/delta);
  const focusItem=item=>{setSelected(item);sceneApiRef.current?.focus(item);setMenu('')};
  const matchesGroup=item=>missionGroup==='all'||missionKinds.find(group=>group.id===missionGroup)?.kinds.includes(item.kind);
  const results=[...(panel==='index'?[]:planets.map(item=>({...item,type:'planet',name:item.en,year:null}))),...missions.filter(matchesGroup).map(item=>({...item,type:'mission'}))].filter(item=>(item.name+' '+item.zh).toLowerCase().includes(query.trim().toLowerCase()));
  const selectFromList=item=>{if(item.type==='mission'){setYear(Math.max(year,item.year));setBody('all');setKind('all')}else setBody('all');focusItem({type:item.type,id:item.id});setPanel('');};
  const toggleMenu=name=>setMenu(value=>value===name?'':name);
  return <div className={`solar-atlas${earthFocused?' is-earth-focused':''}`} onClickCapture={event=>{if(event.target.closest('button, a, select'))playCue();}}>
    <SolarScene paused={earthFocused} year={year} view={view} selected={selected} missionGroup={missionGroup} kind={kind} body={body} hideOrbits={hideOrbits} hideArtificial={hideArtificial} hideNatural={hideNatural} nearby={nearby} autoOrbit={autoOrbit} geoLabels={geoLabels} lang={lang} onSelect={focusItem} onReady={api=>{sceneApiRef.current=api}} onProgress={setBootProgress} />
    <Suspense fallback={<p className="earth-starting" role="status">地球增强模块加载中…</p>}>{earthFocused&&<EarthView onOverview={resetView} hideArtificial={hideArtificial} hideOrbits={hideOrbits}/>}</Suspense>
    <span className="solar-author-watermark" aria-hidden="true">KK-Tiong_Pavelio</span>
    <div className="solar-vignette" aria-hidden="true" />
    <header className="solar-toolbar">
      <div className="solar-toolbar-group"><a className="solar-control solar-home" href="https://ichxjz.com/" aria-label="进入作者网站">↖ <span>作者网站</span></a><span className="solar-wordmark">KK / STARS AND SEA</span></div>
      <div className="solar-toolbar-group solar-center-controls">
        <button className="solar-control" aria-expanded={menu==='objects'} onClick={()=>toggleMenu('objects')}>对象 <b>{kind==='all'?'全部任务':kind==='missions'?'任务':'天体'} · {missions.length}</b>⌄</button>
        <label className="solar-control solar-select">天体 <select aria-label="选择天体" value={body} onChange={event=>{const value=event.target.value;setBody(value);if(value==='all'){setSelected(null);resetView()}else focusItem({type:'planet',id:value})}}><option value="all">全部天体</option>{planets.map(item=><option key={item.id} value={item.id}>{item.zh}</option>)}</select></label>
        <button className="solar-control" aria-expanded={menu==='view'} onClick={()=>toggleMenu('view')}>视图 <b>{view==='side'?'侧视排列':view==='orbit'?'三维排列':'当下近似'}</b>⌄</button>
        <button className="solar-control" aria-expanded={menu==='layers'} onClick={()=>toggleMenu('layers')}>图层与轨道 ⌄</button>
      </div>
      <div className="solar-toolbar-group solar-right-controls"><button className="solar-control" aria-label="切换天体标签语言" onClick={()=>setLang(value=>value==='zh'?'en':'zh')}>标签 {lang==='zh'?'中 / EN':'ZH / EN'}</button><button className="solar-control" onClick={()=>{setPanel('index');setQuery('');}}>任务图鉴</button><button className="solar-control" onClick={()=>{setPanel('search');setQuery('');}}>搜索</button><button className="solar-control" onClick={()=>setPanel('guide')}>指南 / 作者</button></div>
      {menu&&<div className="solar-menu" role="menu">
        {menu==='objects'&&<><span className="solar-menu-title">任务类别</span>{missionKinds.map(group=><button key={group.id} role="menuitemradio" aria-checked={missionGroup===group.id} onClick={()=>{setMissionGroup(group.id);setKind('missions');setMenu('');setPanel('index');}}>{group.label}<b>{group.count}</b></button>)}<button onClick={()=>{setKind('planets');setMenu('');}}>只看天体</button></>}
        {menu==='view'&&<><span className="solar-menu-title">排列方式</span>{[['side','侧视排列','黄道面合成一条线'],['orbit','三维排列','展开轨道倾角'],['live','当下近似','按当前时刻的简化黄经摆开']].map(([id,label,hint])=><button key={id} role="menuitemradio" aria-checked={view===id} onClick={()=>{setView(id);setMenu('');}}><span>{label}<small>{hint}</small></span></button>)}</>}
        {menu==='layers'&&<><span className="solar-menu-title">图层与轨道</span>{[[hideArtificial,setHideArtificial,'隐藏人造卫星及其轨道'],[hideNatural,setHideNatural,'隐藏自然卫星及其轨道'],[hideOrbits,setHideOrbits,'隐藏所有轨道'],[nearby,setNearby,'显示周边任务']].map(([value,set,label])=><button key={label} role="menuitemcheckbox" aria-checked={value} onClick={()=>set(!value)}>{label}<b>{value?'✓':'—'}</b></button>)}</>}
      </div>}
    </header>
    {!immersive&&<div className="solar-heading"><div className="solar-eyebrow">01 / HUMAN EXPLORATION</div><h1>{lang==='zh'?'人类造物':'STARS AND SEA'}</h1><span className="solar-heading-rule"/><p>{lang==='zh'?'人类在太阳系留下的一份坐标图谱':'A CARTOGRAPHY OF HUMANITY IN THE SOLAR SYSTEM'}</p><span>{missions.length} 条已建档任务 · 八大行星与冥王星</span></div>}
    <div className="solar-stage-caption">{view==='live'?'SIMPLIFIED CURRENT LONGITUDE / 非精确星历':'SCHEMATIC ORBITS / 轨道与大小均为示意'}</div>
    {detail&&<aside className="solar-detail" aria-label="对象详情">
      <button className="solar-close" onClick={()=>setSelected(null)} aria-label="关闭详情">×</button>
      <span className="solar-eyebrow">{detail.type==='planet'?'CELESTIAL BODY':'MISSION ARCHIVE'} / {detail.item.id.toUpperCase()}</span>
      <div className="solar-detail-visual" style={{'--body-map':textureNames[detail.type==='planet'?detail.item.id:detail.item.target]?`url('${basePath}solar/textures/${textureNames[detail.type==='planet'?detail.item.id:detail.item.target]}.jpg')`:'radial-gradient(circle at 35% 35%,#d4c1ad,#836f68 48%,#20242c 80%)'}} aria-hidden="true"><i /></div>
      <h2>{detail.item.en||detail.item.name}</h2><p className="solar-detail-zh">{detail.item.zh}</p>
      <div className="solar-detail-fact"><span>{detail.type==='planet'?'平均日距':'发射日期'}</span><strong>{detail.type==='planet'?`${detail.item.au} AU`:detail.item.date}</strong></div>
      {orbitFact&&<><div className="solar-detail-fact"><span>公转周期</span><strong>{orbitFact.period<1?`${Math.round(orbitFact.period*365.25)} 天`:`${orbitFact.period.toFixed(2)} 年`}</strong></div><div className="solar-detail-fact"><span>轨道倾角 / 离心率</span><strong>{orbitFact.i.toFixed(2)}° / {orbitFact.e.toFixed(3)}</strong></div><p className="solar-ephemeris-note">轨道参数是 J2000 附近的简化均值；大小与距离经视觉缩放。该页面不能用于导航或精密天文计算。</p></>}
      {detail.type==='mission'&&<><div className="solar-detail-fact"><span>任务类别</span><strong>{missionKinds.find(group=>group.kinds.includes(detail.item.kind))?.label}</strong></div><div className="solar-detail-fact"><span>执行机构</span><strong>{detail.item.operator}</strong></div><div className="solar-detail-fact"><span>目标 / 轨道类型</span><strong>{detail.item.system.toUpperCase()} · {detail.item.orbit}</strong></div><div className="solar-detail-fact"><span>任务状态</span><strong>{detail.item.status}</strong></div></>}
      <p>{detail.item.note}</p>
      {detail.type==='mission'&&<p className="solar-ephemeris-note">历史/示意位置非实时。轨道数据暂不可用；没有有效当前星历时不伪造任务位置。</p>}
      {detail.type==='planet'&&<div className="solar-nearby-list"><span>周边任务</span>{missions.filter(item=>item.target===detail.item.id).slice(0,3).map(item=><button key={item.id} onClick={()=>focusItem({type:'mission',id:item.id})}>{item.name} ↗</button>)}</div>}
      <button className="solar-control" onClick={()=>{setBody(detail.type==='planet'?detail.item.id:detail.item.target);setSelected(null);}}>聚焦相关天体 ↗</button>
    </aside>}
    <div className="solar-zoom"><button onClick={()=>changeZoom(1.2)} aria-label="放大">＋</button><span>3D</span><button onClick={()=>changeZoom(1/1.2)} aria-label="缩小">－</button><button onClick={resetView} aria-label="重置视图">◎</button></div>
    <div className="solar-actions"><button className="solar-control" onClick={()=>{setView('orbit');setAutoOrbit(value=>!value);}} aria-pressed={autoOrbit}>{autoOrbit?'停止环绕':'自动环绕'}</button><button className="solar-control" onClick={()=>setGeoLabels(value=>!value)} aria-pressed={geoLabels}>地理标注 {geoLabels?'开':'关'}</button><button className="solar-control" onClick={()=>setImmersive(value=>!value)} aria-pressed={immersive}>{immersive?'退出沉浸':'沉浸观看'}</button><button className="solar-control" onClick={()=>setSound(value=>!value)} aria-pressed={sound}>交互音效 {sound?'开':'关'}</button><button className="solar-control" onClick={()=>setMusic(value=>!value)} aria-pressed={music}>背景音乐 {music?'开':'关'}</button></div>
    <div className="solar-hint">左键拖动旋转 · Shift 拖动平移 · 滚轮缩放</div>
    {!immersive&&<section className="solar-timeline" aria-label="任务年代轴"><div className="solar-timeline-top"><strong>{year}</strong><span>{missions.filter(item=>item.year<=year).length} / {missions.length} 条任务档案</span><span className="solar-live-status">0/0 有效当前位置 · 档案示意</span><button onClick={()=>setPlaying(value=>!value)} aria-label={playing?'暂停回放':'回放年代'}>{playing?'Ⅱ 暂停':'▶ 回放这段时期'}</button><span className="solar-timeline-note">拖动时间线 · 圆点为发射年份</span></div><div className="solar-range-wrap"><input type="range" min={yearMin} max={yearMax} value={year} onChange={event=>{setPlaying(false);setYear(Number(event.target.value));}} aria-label="选择年份" style={{'--range-progress':`${(year-yearMin)/(yearMax-yearMin)*100}%`}}/><div className="solar-year-dots" aria-hidden="true">{missions.map(item=><i key={item.id} style={{left:`${(item.year-yearMin)/(yearMax-yearMin)*100}%`}} />)}</div></div><div className="solar-ticks"><span>1957</span><span>1970</span><span>1980</span><span>1990</span><span>2000</span><span>2010</span><span>2026</span></div></section>}
    {panel&&<div className="solar-panel-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setPanel('');}}><section className="solar-panel" role="dialog" aria-modal="true" aria-label={panel==='guide'?'操作指南':panel==='search'?'搜索对象':'任务图鉴'}><button className="solar-close" onClick={()=>setPanel('')} aria-label="关闭面板">×</button>{panel==='guide'?<><span className="solar-eyebrow">HOW TO EXPLORE / ABOUT</span><h2>图谱指南</h2><p>左键或手指拖动可旋转视图，Shift 拖动平移；滚轮和右下角按钮用于缩放。点击天体或任务会推进到该对象并查看详情，底部时间线可回放任务发射年代。</p><p>侧视排列把黄道面压成一条线；三维排列展开轨道倾角；实时全览按简化周期模型摆放天体，仅作视觉参考，不是精确星历。</p><p>本开源核心版收录 18 条选录任务。位置均为示意，地球卫星增强视图按需读取公开 GP 并用 SGP4 推算；数据不可用时支持导入，不伪造卫星。不代表线上完整档案。</p><p>独立设计实现：KK · 独立 3D 图谱核心。天体贴图：Solar System Scope（CC BY 4.0）。</p></>:<><span className="solar-eyebrow">{panel==='search'?'OBJECT SEARCH':'任务图鉴 / MISSION INDEX'}</span><h2>{panel==='search'?'搜索对象':missions.length}</h2><p className="solar-index-lead">可检索任务档案。任务档案与轨道快照分别统计；下方轨道图层的一条记录，不等于同等数量的完整任务档案。</p><p className="solar-ephemeris-note">历史/示意位置非实时 · 0/0 条有效当前位置。轨道数据暂不可用；其余任务保留档案示意。</p><div className="solar-kind-tabs">{missionKinds.map(group=><button key={group.id} aria-pressed={missionGroup===group.id} onClick={()=>setMissionGroup(group.id)}>{group.label} · {group.count}</button>)}</div><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="输入天体或任务名称…" aria-label="搜索天体或任务"/><div className="solar-result-list">{results.map(item=><button key={item.type+item.id} onClick={()=>selectFromList(item)}><span><b>{item.name}</b><small>{item.zh} · {item.type==='mission'?missionKinds.find(group=>group.kinds.includes(item.kind))?.label:'天体'}</small></span><span>{item.year||`${item.au} AU`}</span></button>)}{!results.length&&<p>没有找到匹配的对象。</p>}</div></>}</section></div>}
    {bootProgress.loaded<bootProgress.total&&bootProgress.sceneReady&&<div className="solar-texture-status" role="status">HD {bootProgress.loaded}/{bootProgress.total} · {bootProgress.failed?`${bootProgress.failed} 张贴图失败，保留基础色彩`:'高清贴图后台加载'}</div>}
    {entered?<div className="solar-credit"><a href="https://science.nasa.gov/solar-system/solar-system-facts/" target="_blank" rel="noopener noreferrer">天体资料：NASA Science ↗</a><a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">天体贴图：Solar System Scope / CC BY 4.0 ↗</a><a href="https://solar-system-atlas.pages.dev/solar/" target="_blank" rel="noopener noreferrer">视觉参考：HUMAN ARTIFACTS ↗</a></div>:(!bootProgress.sceneReady||!bootDelayDone)?<div className="solar-boot" role="status" aria-live="polite"><div className="solar-boot-dial" style={{'--boot-progress':`${(bootProgress.sceneReady?1:bootProgress.workerReady?.65:.25)*100}%`}}><div className="solar-boot-ticks" aria-hidden="true">{Array.from({length:72},(_,index)=><i key={index} style={{'--tick':index}} />)}</div><span>SCENE STARTUP<strong>{String(Math.round((bootProgress.sceneReady?1:bootProgress.workerReady?.65:.25)*100)).padStart(3,'0')}%</strong><small>{bootProgress.error|| (bootProgress.sceneReady?'场景就绪，高清贴图后台加载':'轨道计算与首帧绘制中')}</small></span></div>{bootProgress.error&&<button className="solar-control solar-boot-retry" onClick={()=>location.reload()}>重新加载场景</button>}<div className="solar-boot-stages"><span>01 ✓　MISSION ARCHIVE / {missions.length}</span><span>02 {bootProgress.loaded>=bootProgress.total?'✓':'↻'}　SURFACE MAPS / {bootProgress.loaded}–{bootProgress.total} · {bootProgress.failed||0} FAILED</span><span>03 {bootProgress.workerReady?'✓':'↻'}　ORBIT WORKER / {bootProgress.workerReady?'READY':'CALCULATING'}</span></div></div>:<div className="solar-intro"><div className="solar-intro-planets" aria-hidden="true">{['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'].map(name=><i key={name} className={`solar-intro-planet solar-intro-planet-${name}`} />)}</div><div className="solar-intro-content"><div className="solar-eyebrow">AN INDEPENDENT VISUAL STUDY / 2026</div><h2>SOLAR<br/><em>ATLAS</em></h2><span className="solar-heading-rule"/><p>沿着人类探测任务的线索，重新观看太阳系。</p><p className="solar-intro-sub">八大行星与冥王星 · {missions.length} 条任务档案 · 一条持续延伸的时间轴</p><button onClick={()=>setEntered(true)}>进入图谱 <span>↗</span></button><small>轨道与任务位置均为视觉示意 · <a href="https://solar-system-atlas.pages.dev/solar/" target="_blank" rel="noopener noreferrer">视觉参考 ↗</a></small></div><a className="solar-intro-back" href="https://ichxjz.com/">← 作者网站</a></div>}
  </div>;
}
