
import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
const canvas=document.querySelector('#stage'), viewport=document.querySelector('.viewport');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);
const scene=new THREE.Scene();scene.background=null;
const camera=new THREE.PerspectiveCamera(42,viewport.clientWidth/viewport.clientHeight,.1,100);camera.position.set(9,7,12);camera.lookAt(0,0,0);
const ambient=new THREE.HemisphereLight(0xffffff,0x555566,2);scene.add(ambient);
const grid=new THREE.GridHelper(20,20,0x59604e,0x343a32);grid.position.y=-2.5;scene.add(grid);
const root=new THREE.Group();scene.add(root);
const testCube=new THREE.Group();const cubeMesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:0xff765e,roughness:.48,metalness:.05}));const cubeEdges=new THREE.LineSegments(new THREE.EdgesGeometry(cubeMesh.geometry),new THREE.LineBasicMaterial({color:0x282321,linewidth:2}));testCube.add(cubeMesh,cubeEdges);testCube.visible=true;scene.add(testCube);
const transform=new TransformControls(camera,renderer.domElement);scene.add(transform);transform.setMode('translate');let gizmoDragging=false;
const gizmoRoot=transform._gizmo;
const gizmoUpdate=gizmoRoot.updateMatrixWorld.bind(gizmoRoot);
gizmoRoot.updateMatrixWorld=function(force){
  const active=this.mode;
  for(const mode of ['translate','rotate','scale']){
    this.mode=mode;
    gizmoUpdate(force);
  }
  this.mode=active;
  for(const mode of ['translate','rotate','scale']){
    this.gizmo[mode].visible=true;
    this.helper[mode].visible=true;
  }
};
const originalTransformHover=transform.pointerHover.bind(transform);
transform.pointerHover=function(pointer){const raycaster=this.getRaycaster();raycaster.setFromCamera(new THREE.Vector2(pointer.x,pointer.y),camera);let chosen=null,best=Infinity;for(const mode of ['translate','rotate','scale']){const hits=raycaster.intersectObjects(this._gizmo.gizmo[mode].children,true);if(hits.length&&hits[0].distance<best){best=hits[0].distance;chosen=mode;}}if(chosen)this.setMode(chosen);return originalTransformHover(pointer);};
const originalTransformUpdate=transform.updateMatrixWorld.bind(transform);
transform.updateMatrixWorld=function(force){if(this.object&&this.object.parent===null){const stale=this.object;this.detach();if(selectedStroke===stale)selectedStroke=null;}return originalTransformUpdate(force);};transform.addEventListener('mouseDown',()=>{if(transform.object)transformBefore={position:transform.object.position.toArray(),quaternion:transform.object.quaternion.toArray(),scale:transform.object.scale.toArray()};});transform.addEventListener('mouseUp',()=>{if(transform.object&&transformBefore){const object=transform.object,after={position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray()};if(JSON.stringify(transformBefore)!==JSON.stringify(after))recordAction({type:'transform',object,before:transformBefore,after});transformBefore=null;}});transform.addEventListener('dragging-changed',e=>{gizmoDragging=e.value;orbit.enabled=false;if(gizmoDragging){if(drawing)finishStroke(false);activePointers.clear();gestureState=null;mouseCamera=null;}});
const orbit=new (await import('three/addons/controls/OrbitControls.js')).OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.enableZoom=true;orbit.enablePan=true;orbit.enableRotate=true;orbit.minDistance=2.5;orbit.maxDistance=40;orbit.zoomSpeed=.9;orbit.panSpeed=.85;orbit.rotateSpeed=.75;orbit.target.set(0,0,0);orbit.enabled=false;
let activeLayer=0,tool='draw',color='#d9f78a',brushSize=6,eraserRadiusPx=6,opacity=1,velocitySensitivity=1,endTaper=.35,brushPreset='ink',textureAmount=.45,drawing=false,currentPoints=[],currentBrushSamples=[],currentLine=null,undoStack=[],redoStack=[],keyframes=[],playing=false,playStart=0;let lastBrushPointer=null,smoothedBrushSpeed=0;
const layers=[];
function addLayer(name='Layer '+(layers.length+1)){const group=new THREE.Group();group.name=name;root.add(group);layers.push({name,group,visible:true});activeLayer=layers.length-1;renderLayers();}
addLayer('Starfish');addLayer('Details');activeLayer=0;
function renderLayers(){const el=document.querySelector('#layers');el.innerHTML='';layers.forEach((l,i)=>{const row=document.createElement('div');row.className='layer'+(i===activeLayer?' active':'');row.innerHTML='<span class="dot"></span><span></span><button title="Visibility">◉</button>';row.children[1].textContent=l.name;row.addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){l.visible=!l.visible;l.group.visible=l.visible;e.target.textContent=l.visible?'◉':'○';return;}activeLayer=i;renderLayers();if(tool==='select'&&l.group.children.length)transform.attach(l.group);if(tool==='move')selectStroke(null);});el.append(row);});}
// History stores object references, never full serialized copies of the entire scene.
function recordAction(action){undoStack.push(action);if(undoStack.length>500)undoStack.shift();redoStack=[];}
function applyStrokeTransform(a,forward){const v=forward?a.after:a.before;a.object.position.fromArray(v.position);a.object.quaternion.fromArray(v.quaternion);a.object.scale.fromArray(v.scale);}
function undoAction(){const action=undoStack.pop();if(!action)return;if(action.type==='add'){action.group.remove(action.object);}else if(action.type==='clear'){for(const object of action.objects)action.group.add(object);}else if(action.type==='replace'){for(const object of action.added)action.group.remove(object);for(const object of action.removed)action.group.add(object);}else if(action.type==='transform')applyStrokeTransform(action,false);redoStack.push(action);}
function redoAction(){const action=redoStack.pop();if(!action)return;if(action.type==='add'){action.group.add(action.object);}else if(action.type==='clear'){for(const object of action.objects){action.group.remove(object);if(selectedStroke===object){transform.detach();selectedStroke=null;}}}else if(action.type==='replace'){for(const object of action.removed){action.group.remove(object);if(selectedStroke===object){transform.detach();selectedStroke=null;}}for(const object of action.added)action.group.add(object);}else if(action.type==='transform')applyStrokeTransform(action,true);undoStack.push(action);}
// Each stroke lives on a camera-facing plane through the current 3D orbit target.
// Rotating the camera changes the plane, so strokes can be drawn in any view direction.
const strokePlane=new THREE.Plane();
const pointerRaycaster=new THREE.Raycaster();
function prepareStrokePlane(){
  // Refresh camera transforms before building the stroke plane. Its local X/Y axes
  // follow the camera's screen-right/screen-up directions, so left-right and
  // up-down finger movement both map cleanly into the same stable 3D plane.
  camera.updateMatrixWorld(true);
  const normal=new THREE.Vector3();
  camera.getWorldDirection(normal).normalize();
  strokePlane.setFromNormalAndCoplanarPoint(normal,orbit.target.clone());
  pointerRaycaster.near=0;
  pointerRaycaster.far=1000;
}
function pointFromEvent(e){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const x=((e.clientX-rect.left)/rect.width)*2-1;
  const y=-((e.clientY-rect.top)/rect.height)*2+1;
  pointerRaycaster.setFromCamera(new THREE.Vector2(x,y),camera);
  const point=new THREE.Vector3();
  return pointerRaycaster.ray.intersectPlane(strokePlane,point)?point:null;
}
function strokeMaterial(style={}){const strokeColor=style.color??color,strokeOpacity=style.opacity??opacity;return new THREE.MeshStandardMaterial({color:strokeColor,transparent:strokeOpacity<1,opacity:strokeOpacity,roughness:.82,metalness:0,depthWrite:strokeOpacity>=1,depthTest:true});}
function sampleBrushVelocity(e,reset=false){
  const now=Number.isFinite(e.timeStamp)?e.timeStamp:performance.now();
  let speed=0;
  if(!reset&&lastBrushPointer){const dt=Math.max(1,now-lastBrushPointer.time);speed=Math.hypot(e.clientX-lastBrushPointer.x,e.clientY-lastBrushPointer.y)/dt;}
  lastBrushPointer={x:e.clientX,y:e.clientY,time:now};
  smoothedBrushSpeed=reset?0:THREE.MathUtils.lerp(smoothedBrushSpeed,speed,.38);
  const response=THREE.MathUtils.clamp(1.45-(smoothedBrushSpeed/1.8)*1.1,.32,1.45);
  const width=THREE.MathUtils.lerp(1,response,velocitySensitivity);
  return {width,height:1,angle:0};
}

function makeSquareStroke(points,style={}){
  if(!points.length)return null;
  const strokeSize=style.size??brushSize,strokeColor=style.color??color,strokeOpacity=style.opacity??opacity;
  const preset=style.preset??brushPreset,texture=THREE.MathUtils.clamp(style.texture??textureAmount,0,1),taperAmount=style.taper??endTaper;
  const radius=Math.max(.012,strokeSize*.008);
  const config={ink:{sides:4,roundness:0,noise:0,opacity:1,width:1,height:1},round:{sides:14,roundness:1,noise:0,opacity:1,width:1,height:1},ribbon:{sides:4,roundness:0,noise:0,opacity:1,width:1.35,height:.28},chalk:{sides:12,roundness:1,noise:.12,opacity:.92,width:1.12,height:1},dry:{sides:10,roundness:1,noise:.25,opacity:.82,width:.9,height:1}}[preset]||{sides:4,roundness:0,noise:0,opacity:1,width:1,height:1};
  const finalOpacity=strokeOpacity*config.opacity,savedStyle={color:strokeColor,opacity:strokeOpacity,size:strokeSize,preset,texture,taper:taperAmount};
  if(points.length===1){
    const geometry=preset==='round'||preset==='chalk'||preset==='dry'?new THREE.SphereGeometry(radius,12,8):new THREE.BoxGeometry(radius*2,radius*2,radius*2);
    const dab=new THREE.Mesh(geometry,strokeMaterial({color:strokeColor,opacity:finalOpacity}));dab.position.copy(points[0]);dab.userData.stroke=true;dab.userData.centerline=[[0,0,0]];dab.userData.style=savedStyle;dab.renderOrder=++strokeRenderOrder;return dab;
  }
  const curve=new THREE.CatmullRomCurve3(points),segments=Math.max(12,points.length*4),frames=curve.computeFrenetFrames(segments,false),sides=config.sides,samples=style.samples||[],positions=[],indices=[],colors=[];
  const sampleAt=t=>{if(!samples.length)return {width:1,height:1,angle:0};const q=t*(samples.length-1),i=Math.min(samples.length-1,Math.floor(q)),j=Math.min(samples.length-1,i+1),f=q-i,a=samples[i],b=samples[j];return {width:THREE.MathUtils.lerp(a.width??1,b.width??1,f),height:THREE.MathUtils.lerp(a.height??1,b.height??1,f),angle:THREE.MathUtils.lerp(a.angle??0,b.angle??0,f)};};
  const noiseAt=(i,j)=>{const v=Math.sin((i+1)*127.1+(j+3)*311.7)*43758.5453;return (v-Math.floor(v))*2-1;};
  for(let i=0;i<=segments;i++){
    const t=i/segments,p=curve.getPointAt(t),n=frames.normals[i],b=frames.binormals[i],sample=sampleAt(t),taper=Math.max(.035,Math.min(1,Math.min(taperAmount>0?(.08+t/taperAmount):1,taperAmount>0?(.08+(1-t)/taperAmount):1))),angle=sample.angle||0,ca=Math.cos(angle),sa=Math.sin(angle),axisA=n.clone().multiplyScalar(ca).addScaledVector(b,sa),axisB=b.clone().multiplyScalar(ca).addScaledVector(n,-sa),halfA=radius*config.width*Math.max(.12,sample.width)*taper,halfB=radius*config.height*Math.max(.12,sample.height)*taper,longNoise=config.noise*texture*noiseAt(i,5);
    for(let j=0;j<sides;j++){
      let u,v;if(sides===4){[[u,v]]=[[1,1],[-1,1],[-1,-1],[1,-1]].slice(j,j+1);}else{const a=j/sides*Math.PI*2;u=Math.cos(a);v=Math.sin(a);}
      const edge=1+(longNoise+config.noise*texture*.22*noiseAt(i,j))*(config.roundness?1:.35),q=p.clone().addScaledVector(axisA,u*halfA*edge).addScaledVector(axisB,v*halfB*edge);positions.push(q.x,q.y,q.z);
      if(config.noise>0){const grain=1-(noiseAt(i,j)*.5+.5)*texture*.28;colors.push(grain,grain,grain);}
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+(j+1)%sides,d=(i+1)*sides+j;indices.push(a,b,d,b,c,d);}
  const startCap=positions.length/3;positions.push(...points[0].toArray());const endCap=startCap+1;positions.push(...points[points.length-1].toArray());if(config.noise>0)colors.push(1,1,1,1,1,1);
  for(let j=0;j<sides;j++){const next=(j+1)%sides;indices.push(startCap,next,j);const base=segments*sides;indices.push(endCap,base+j,base+next);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(colors.length)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=strokeMaterial({color:strokeColor,opacity:finalOpacity});material.flatShading=preset==='ink'||preset==='ribbon';material.side=THREE.DoubleSide;material.vertexColors=colors.length>0;material.needsUpdate=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.stroke=true;const center=new THREE.Vector3();geometry.computeBoundingBox();geometry.boundingBox.getCenter(center);geometry.translate(-center.x,-center.y,-center.z);mesh.position.copy(center);mesh.userData.centerline=points.map(p=>p.clone().sub(center).toArray());mesh.userData.style=savedStyle;mesh.userData.brushSamples=samples;mesh.renderOrder=++strokeRenderOrder;return mesh;
}
function makeStroke(points){
  const mesh=makeSquareStroke(points,{color,opacity,size:brushSize,samples:currentBrushSamples,preset:brushPreset,texture:textureAmount,taper:endTaper});if(mesh){const group=layers[activeLayer].group;group.add(mesh);recordAction({type:'add',group,object:mesh});}
}
function pointSegmentDistanceSq(p,a,b){const ab=b.clone().sub(a),den=ab.lengthSq();if(den<1e-10)return p.distanceToSquared(a);const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/den,0,1);return p.distanceToSquared(a.add(ab.multiplyScalar(t)));}
function projectErasePoint(point){
  const projected=point.clone().project(camera),rect=viewport.getBoundingClientRect();
  return {x:(projected.x*.5+.5)*rect.width,y:(-.5*projected.y+.5)*rect.height,z:projected.z};
}
function distanceToErasePathPx(point,path){
  if(path.length===1){const dx=point.x-path[0].x,dy=point.y-path[0].y;return dx*dx+dy*dy;}
  let best=Infinity;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den<1e-8?0:THREE.MathUtils.clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/den,0,1);
    const x=a.x+dx*t,y=a.y+dy*t,px=point.x-x,py=point.y-y;
    best=Math.min(best,px*px+py*py);
  }
  return best;
}
let selectedStroke=null,transformBefore=null;
function highlightStroke(o,on){if(!o?.material?.emissive)return;if(on){if(o.userData.selectionEmissive===undefined)o.userData.selectionEmissive=o.material.emissive.getHex();o.material.emissive.setHex(0xff684d);}else if(o.userData.selectionEmissive!==undefined){o.material.emissive.setHex(o.userData.selectionEmissive);delete o.userData.selectionEmissive;}}
function findStrokeAtScreen(x,y,group){const rect=viewport.getBoundingClientRect(),local={x:x-rect.left,y:y-rect.top};let best=null,bestSq=24*24;for(const o of group.children){if(!o.userData.stroke||!o.userData.centerline)continue;const projected=o.userData.centerline.map(p=>projectErasePoint(o.localToWorld(new THREE.Vector3(...p))));const d=distanceToErasePathPx(local,projected);if(d<bestSq){bestSq=d;best=o;}}return best;}
function selectStroke(o){if(selectedStroke&&selectedStroke!==o)highlightStroke(selectedStroke,false);selectedStroke=o;if(o)highlightStroke(o,true);if(tool==='move'){if(o){transform.attach(o);}else{transform.detach();}}}
function beginPendingDraw(p){const point=p.point?.clone();if(!point)return;drawing=true;activeStrokeTool=p.tool;activeStrokeGroup=p.group;currentPoints=[point];smoothedBrushSpeed=0;lastBrushPointer=null;currentBrushSamples=[sampleBrushVelocity({clientX:p.x,clientY:p.y,timeStamp:p.timeStamp},true)];if(p.tool==='erase'){eraserScreenPoints=[];addEraserScreenPoint({clientX:p.x,clientY:p.y});updateEraserPreview();}else updateStrokePreview();}
function compactErasePath(path){
  if(path.length<3)return path;
  const compact=[path[0]];let last=path[0];
  for(let i=1;i<path.length-1;i++){const p=path[i];if(Math.hypot(p.x-last.x,p.y-last.y)>=6){compact.push(p);last=p;}}
  compact.push(path[path.length-1]);return compact;
}
function findEraserHits(path,group){
  const erasePath=compactErasePath(path.map(projectErasePoint)),radiusSq=eraserRadiusPx*eraserRadiusPx,hits=[];
  for(const object of group.children){
    if(!object.userData.stroke||!object.userData.centerline)continue;
    const source=object.userData.centerline;if(!source.length)continue;
    const curve=source.length>=2?new THREE.CatmullRomCurve3(source.map(p=>object.localToWorld(new THREE.Vector3(...p)))):null;
    const count=curve?Math.min(900,Math.max(24,source.length*3)):1;
    let hit=false;
    for(let i=0;i<count;i++){
      const p=curve?curve.getPointAt(count===1?0:i/(count-1)):object.localToWorld(new THREE.Vector3(...source[0]));
      if(distanceToErasePathPx(projectErasePoint(p),erasePath)<=radiusSq){hit=true;break;}
    }
    if(hit)hits.push(object);
  }
  return hits;
}
function computeEraserResult(path,group){
  const removed=[],added=[];if(!path.length)return {removed,added};
  const erasePath=compactErasePath(path.map(projectErasePoint)),radiusSq=eraserRadiusPx*eraserRadiusPx;
  for(const object of [...group.children]){
    if(!object.userData.stroke||!object.userData.centerline)continue;
    const source=object.userData.centerline.map(p=>object.localToWorld(new THREE.Vector3(...p)));if(!source.length)continue;
    const curve=source.length>=2?new THREE.CatmullRomCurve3(source):null;
    // Dense, evenly spaced samples prevent short leftover islands between
    // the old coarse samples. A small screen-space tolerance includes the
    // visible stroke edge, not only its mathematical centerline.
    const count=curve?Math.min(2400,Math.max(96,source.length*8)):1;
    const samples=curve?curve.getSpacedPoints(count-1):source;
    const keep=[];let run=[];
    const effectiveRadius=eraserRadiusPx+1.5;
    const effectiveRadiusSq=effectiveRadius*effectiveRadius;
    const hitFlags=samples.map(p=>distanceToErasePathPx(projectErasePoint(p),erasePath)<=effectiveRadiusSq);
    // Expand each hit by one neighbor on either side so a sub-sample sliver
    // cannot survive as an un-erasable fragment.
    for(let i=0;i<hitFlags.length;i++){
      if(hitFlags[i]){if(i>0)hitFlags[i-1]=true;if(i+1<hitFlags.length)hitFlags[i+1]=true;}
    }
    for(let i=0;i<samples.length;i++){
      const p=samples[i],hit=hitFlags[i];
      if(hit){if(run.length)keep.push(run);run=[];}else run.push(p);
    }
    if(run.length)keep.push(run);
    if(!keep.length||keep.length===1&&keep[0].length===samples.length)continue;
    removed.push(object);
    for(const segment of keep){
      if(segment.length<2&&samples.length>1)continue;
      const replacement=makeSquareStroke(segment,object.userData.style||{});
      if(replacement){replacement.renderOrder=object.renderOrder;added.push(replacement);}
    }
  }
  return {removed,added};
}
let eraserPreview=null;
let activeStrokeTool=null,activeStrokeGroup=null;
const eraserPreviewCanvas=document.querySelector('#eraserPreviewCanvas');
const eraserPreviewCtx=eraserPreviewCanvas.getContext('2d');
let eraserScreenPoints=[];
function resizeEraserPreview(){const r=viewport.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);eraserPreviewCanvas.width=Math.max(1,Math.round(r.width*dpr));eraserPreviewCanvas.height=Math.max(1,Math.round(r.height*dpr));eraserPreviewCtx.setTransform(dpr,0,0,dpr,0,0);}
function clearEraserInk(){eraserPreviewCtx.clearRect(0,0,eraserPreviewCanvas.width,eraserPreviewCanvas.height);}
function addEraserScreenPoint(e){const r=viewport.getBoundingClientRect();eraserScreenPoints.push({x:e.clientX-r.left,y:e.clientY-r.top});}
function clearEraserPreview(){if(!eraserPreview)return;for(const object of eraserPreview.added||[]){eraserPreview.group.remove(object);object.geometry?.dispose();object.material?.dispose();}for(const object of eraserPreview.removed)object.visible=true;eraserPreview=null;}
function updateEraserPreview(){
  // Screen-space paper mask: instant feedback without rebuilding 3D meshes.
  clearEraserPreview();clearEraserInk();if(!eraserScreenPoints.length)return;
  const ctx=eraserPreviewCtx;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(2,eraserRadiusPx*2);ctx.strokeStyle='#fff8e9';ctx.fillStyle='#fff8e9';
  if(eraserScreenPoints.length===1){ctx.beginPath();ctx.arc(eraserScreenPoints[0].x,eraserScreenPoints[0].y,Math.max(1,eraserRadiusPx),0,Math.PI*2);ctx.fill();}
  else{ctx.beginPath();ctx.moveTo(eraserScreenPoints[0].x,eraserScreenPoints[0].y);for(let i=1;i<eraserScreenPoints.length;i++)ctx.lineTo(eraserScreenPoints[i].x,eraserScreenPoints[i].y);ctx.stroke();}
  ctx.strokeStyle='#ff684d';ctx.lineWidth=1.25;ctx.setLineDash([4,4]);
  if(eraserScreenPoints.length===1){ctx.beginPath();ctx.arc(eraserScreenPoints[0].x,eraserScreenPoints[0].y,Math.max(1,eraserRadiusPx),0,Math.PI*2);ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(eraserScreenPoints[0].x,eraserScreenPoints[0].y);for(let i=1;i<eraserScreenPoints.length;i++)ctx.lineTo(eraserScreenPoints[i].x,eraserScreenPoints[i].y);ctx.stroke();}ctx.restore();
}
function commitEraserPreview(){
  // The live pass deliberately leaves source strokes visible. Commit the
  // actual cut once, on release, against the layer captured at pointerdown.
  clearEraserPreview();
  const group=activeStrokeGroup||layers[activeLayer].group;
  const result=computeEraserResult(currentPoints,group);
  if(!result.removed.length)return;
  for(const object of result.removed)group.remove(object);
  for(const object of result.added)group.add(object);
  recordAction({type:'replace',group,...result});
}
let previewFrame=0,strokeRenderOrder=10;
function updateStrokePreview(){
  if(currentLine){layers[activeLayer].group.remove(currentLine);currentLine.geometry.dispose();currentLine.material.dispose();currentLine=null;}
  if(currentPoints.length<2)return;
  const stride=Math.max(1,Math.ceil(currentPoints.length/220));
  const previewPoints=currentPoints.filter((_,i)=>i%stride===0);
  if(previewPoints[previewPoints.length-1]!==currentPoints[currentPoints.length-1])previewPoints.push(currentPoints[currentPoints.length-1]);
  const previewSamples=currentBrushSamples.filter((_,i)=>i%stride===0);if(previewSamples[previewSamples.length-1]!==currentBrushSamples[currentBrushSamples.length-1])previewSamples.push(currentBrushSamples[currentBrushSamples.length-1]);currentLine=makeSquareStroke(previewPoints,{samples:previewSamples,preset:brushPreset,texture:textureAmount,taper:endTaper});if(currentLine)layers[activeLayer].group.add(currentLine);
}
function scheduleStrokePreview(){if(previewFrame)return;previewFrame=requestAnimationFrame(()=>{previewFrame=0;if(!drawing)return;if(activeStrokeTool==='erase')updateEraserPreview();else updateStrokePreview();});}
function clearPreview(){if(previewFrame){cancelAnimationFrame(previewFrame);previewFrame=0;}if(currentLine){layers[activeLayer].group.remove(currentLine);currentLine.geometry.dispose();currentLine.material.dispose();currentLine=null;}clearEraserPreview();clearEraserInk();eraserScreenPoints=[];}
function finishStroke(commit=true){
  if(!drawing)return;
  const completedTool=activeStrokeTool||tool;
  drawing=false;
  if(commit&&currentPoints.length){
    if(completedTool==='erase'){
      // Rebuild from the complete path against the same layer/tool captured at pointerdown.
      updateEraserPreview();
      commitEraserPreview();
    }else{
      clearPreview();
      makeStroke(currentPoints);
    }
  }else clearPreview();
  clearEraserInk();eraserScreenPoints=[];
  currentPoints=[];currentBrushSamples=[];
  activeStrokeTool=null;
  activeStrokeGroup=null;
}
// One finger draws. Two fingers take over for camera orbit and pinch zoom.
const activePointers=new Map();
let gestureState=null,mouseCamera=null;
const cameraTarget=orbit.target;
function cameraOrbit(dx,dy){
  const offset=camera.position.clone().sub(cameraTarget);
  const spherical=new THREE.Spherical().setFromVector3(offset);
  spherical.theta-=dx*.006;spherical.phi=THREE.MathUtils.clamp(spherical.phi-dy*.006,.08,Math.PI-.08);
  offset.setFromSpherical(spherical);camera.position.copy(cameraTarget).add(offset);camera.lookAt(cameraTarget);orbit.update();
}
function cameraPan(dx,dy){
  const distance=camera.position.distanceTo(cameraTarget);
  const scale=distance*.0018;
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
  const shift=right.multiplyScalar(-dx*scale).add(up.multiplyScalar(dy*scale));
  camera.position.add(shift);cameraTarget.add(shift);orbit.update();
}
function zoomBy(factor){cameraZoom(factor);}
function beginTwoFingerGesture(){
  if(drawing)finishStroke(false);
  const pts=[...activePointers.values()];
  if(pts.length<2)return;
  gestureState={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2,
    distance:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)};
}

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY>0?1.08:.92);},{passive:false});
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'){
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId);}catch{}
    if(activePointers.size===2){beginTwoFingerGesture();return;}
    if(activePointers.size>2)return;
  }else if(e.button===2||e.button===1){mouseCamera={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===1||e.shiftKey};try{canvas.setPointerCapture(e.pointerId);}catch{}return;}
  if(transform.dragging||gizmoDragging)return;
  if(tool==='move'){
    const group=layers[activeLayer].group,hit=findStrokeAtScreen(e.clientX,e.clientY,group);
    // Empty canvas taps are not deselection gestures. Tap the selected stroke
    // again to clear it; otherwise the current selection stays attached.
    if(hit)selectStroke(hit===selectedStroke?null:hit);
    return;
  }
  if(tool!=='draw'&&tool!=='erase')return;
  prepareStrokePlane();const startPoint=pointFromEvent(e);if(!startPoint)return;
  beginPendingDraw({x:e.clientX,y:e.clientY,timeStamp:e.timeStamp,tool,group:layers[activeLayer].group,point:startPoint});
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&activePointers.has(e.pointerId)){
    const previous=activePointers.get(e.pointerId);
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2){
      const pts=[...activePointers.values()];
      if(!gestureState){beginTwoFingerGesture();return;}
      const cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;
      const distance=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);
      cameraOrbit(cx-gestureState.x,cy-gestureState.y);
      if(gestureState.distance>1&&distance>1)zoomBy(gestureState.distance/distance);
      gestureState={x:cx,y:cy,distance};return;
    }
  }
  if(mouseCamera&&mouseCamera.id===e.pointerId){
    const dx=e.clientX-mouseCamera.x,dy=e.clientY-mouseCamera.y;
    if(mouseCamera.pan)cameraPan(dx,dy);else cameraOrbit(dx,dy);
    mouseCamera.x=e.clientX;mouseCamera.y=e.clientY;return;
  }
  if(!drawing||gizmoDragging)return;
  const point=pointFromEvent(e);if(!point)return;
  const lastPoint=currentPoints[currentPoints.length-1];
  const shouldAppend=activeStrokeTool==='erase'
    ? Math.hypot(e.clientX-(eraserScreenPoints.length?eraserScreenPoints[eraserScreenPoints.length-1].x+viewport.getBoundingClientRect().left:e.clientX),e.clientY-(eraserScreenPoints.length?eraserScreenPoints[eraserScreenPoints.length-1].y+viewport.getBoundingClientRect().top:e.clientY))>=1.25
    : lastPoint.distanceTo(point)>Math.max(.018,brushSize*.0025);
  if(shouldAppend){
    currentPoints.push(point);if(activeStrokeTool==='draw')currentBrushSamples.push(sampleBrushVelocity(e));if(activeStrokeTool==='erase')addEraserScreenPoint(e);
    if(currentPoints.length>700){const compact=currentPoints.filter((_,i)=>i%2===0),compactSamples=currentBrushSamples.filter((_,i)=>i%2===0);if(compact[compact.length-1]!==currentPoints[currentPoints.length-1]){compact.push(currentPoints[currentPoints.length-1]);if(currentBrushSamples.length)compactSamples.push(currentBrushSamples[currentBrushSamples.length-1]);}currentPoints=compact;currentBrushSamples=compactSamples;}
    scheduleStrokePreview();
  }
});
function endPointer(e){
  if(activePointers.has(e.pointerId)){
    activePointers.delete(e.pointerId);gestureState=null;
    if(activePointers.size===0){if(drawing)finishStroke(true);else currentPoints=[];}
    return;
  }
  if(mouseCamera&&mouseCamera.id===e.pointerId){mouseCamera=null;return;}
  if(drawing)finishStroke(true);
}
canvas.addEventListener('pointerup',endPointer);
function cancelPointer(e){
  if(activePointers.has(e.pointerId)){
    activePointers.delete(e.pointerId);gestureState=null;
    if(drawing)finishStroke(false);
    if(activePointers.size===0)currentPoints=[];
  }
  if(mouseCamera&&mouseCamera.id===e.pointerId)mouseCamera=null;
  if(drawing&&!activePointers.size&&!mouseCamera)finishStroke(false);
}
canvas.addEventListener('pointercancel',cancelPointer);
canvas.addEventListener('lostpointercapture',cancelPointer);
window.addEventListener('blur',()=>{activePointers.clear();gestureState=null;mouseCamera=null;if(drawing)finishStroke(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){activePointers.clear();gestureState=null;mouseCamera=null;if(drawing)finishStroke(false);}});
function setTool(t){if(drawing)finishStroke(true);clearPreview();if(tool==='move'&&t!=='move'&&selectedStroke){highlightStroke(selectedStroke,false);selectedStroke=null;transform.detach();}tool=t;document.querySelectorAll('.rail .tool').forEach(b=>b.classList.remove('active'));({draw:'#drawTool',erase:'#eraseTool',move:'#moveTool',select:'#selectTool',orbit:'#orbitTool'}[t]&&document.querySelector(({draw:'#drawTool',erase:'#eraseTool',move:'#moveTool',select:'#selectTool',orbit:'#orbitTool'}[t])).classList.add('active'));if(t==='draw'||t==='erase'){transform.detach();orbit.enabled=false;}if(t==='move'){orbit.enabled=false;if(selectedStroke){transform.attach(selectedStroke);}else transform.detach();}if(t==='select'){orbit.enabled=false;const g=layers[activeLayer].group;if(g.children.length)transform.attach(g);}if(t==='orbit'){transform.detach();orbit.enabled=true;orbit.enableRotate=true;orbit.enablePan=true;orbit.enableZoom=true;}canvas.style.cursor=t==='draw'||t==='erase'?'none':t==='move'?'grab':'grab';brushCursor.style.display='none';document.querySelector('#hint').textContent=t==='move'?'Tap a stroke to select it, then use the 3D gizmo to move, rotate or scale it':t==='erase'?'Erase parts of strokes on the active layer · Two fingers orbit + pinch to zoom':t==='select'?'Select the active layer and use its 3D transform gizmo':'Draw on the view plane · Rotate the camera to change drawing direction · Two fingers orbit + pinch to zoom';}

document.querySelector('#drawTool').onclick=()=>setTool('draw');document.querySelector('#eraseTool').onclick=()=>setTool(tool==='erase'?'draw':'erase');document.querySelector('#moveTool').onclick=()=>setTool(tool==='move'?'draw':'move');document.querySelector('#selectTool').onclick=()=>setTool(tool==='select'?'draw':'select');
function resetCamera(){orbit.target.set(0,0,0);camera.up.set(0,1,0);camera.position.set(9,7,12);camera.lookAt(0,0,0);camera.fov=42;camera.updateProjectionMatrix();orbit.update();}
function cameraZoom(factor){const offset=camera.position.clone().sub(orbit.target);offset.multiplyScalar(factor);const distance=THREE.MathUtils.clamp(offset.length(),orbit.minDistance,orbit.maxDistance);offset.setLength(distance);camera.position.copy(orbit.target).add(offset);orbit.update();}document.querySelector('#zoomIn').onclick=()=>cameraZoom(.8);document.querySelector('#zoomOut').onclick=()=>cameraZoom(1.25);document.querySelector('#cameraReset').onclick=()=>{resetCamera();};
document.querySelector('#addLayer').onclick=()=>addLayer();document.querySelector('#newBtn').onclick=()=>addLayer();
document.querySelector('#brushPreset').onchange=e=>{brushPreset=e.target.value;document.querySelector('#brushPresetName').textContent=e.target.selectedOptions[0].textContent;};
document.querySelector('#textureAmount').oninput=e=>{textureAmount=+e.target.value/100;document.querySelector('#textureVal').textContent=e.target.value+'%';if(drawing&&activeStrokeTool==='draw')scheduleStrokePreview();};
document.querySelector('#brushSize').oninput=e=>{brushSize=+e.target.value;document.querySelector('#sizeVal').textContent=brushSize+' px';};
document.querySelector('#eraserSize').oninput=e=>{eraserRadiusPx=+e.target.value;document.querySelector('#eraserSizeVal').textContent=eraserRadiusPx+' px';if(drawing&&activeStrokeTool==='erase')scheduleStrokePreview();};
document.querySelector('#opacity').oninput=e=>opacity=+e.target.value/100;
document.querySelector('#velocitySensitivity').oninput=e=>{velocitySensitivity=+e.target.value/100;document.querySelector('#velocitySensitivityVal').textContent=e.target.value+'%';};
document.querySelector('#taper').oninput=e=>{endTaper=+e.target.value/100;document.querySelector('#taperVal').textContent=e.target.value+'%';};


document.querySelectorAll('.swatch').forEach((b,i)=>{if(i===0)b.classList.add('selected');b.onclick=()=>{color=b.dataset.color;document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('selected',s===b));document.querySelector('#brushCursor').style.setProperty('--cursor-color',color);};});
const brushCursor=document.querySelector('#brushCursor');
viewport.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||(tool!=='draw'&&tool!=='erase')){brushCursor.style.display='none';return;}const r=viewport.getBoundingClientRect();brushCursor.style.display='block';brushCursor.style.left=(e.clientX-r.left)+'px';brushCursor.style.top=(e.clientY-r.top)+'px';const diameter=Math.max(2,(tool==='erase'?eraserRadiusPx:brushSize)*2);brushCursor.style.width=brushCursor.style.height=diameter+'px';brushCursor.style.borderRadius=tool==='erase'?'3px':'50%';brushCursor.style.setProperty('--cursor-color',tool==='erase'?'#ff684d':color);});
viewport.addEventListener('pointerleave',()=>brushCursor.style.display='none');
function comicPop(x,y,label='NICE!'){const el=document.createElement('div');el.className='comic-pop';el.textContent=label;el.style.left=x+'px';el.style.top=y+'px';document.body.append(el);setTimeout(()=>el.remove(),650);}
document.querySelectorAll('.top-actions button,.bottom button,.rail button').forEach(btn=>btn.addEventListener('click',()=>{const r=btn.getBoundingClientRect();const labels={'saveBtn':'SAVED!','exportBtn':'INK IT!','addLayer':'NEW PAGE!','newBtn':'NEW PAGE!','clearBtn':'FRESH SHEET!','keyBtn':'SNAP!','playBtn':'ACTION!'};const label=labels[btn.id];if(label)comicPop(r.left+r.width/2,r.top+r.height/2,label);}));
document.querySelector('#clearBtn').onclick=()=>{const group=layers[activeLayer].group;if(!group.children.length)return;recordAction({type:'clear',group,objects:[...group.children]});group.clear();transform.detach();selectedStroke=null;};
document.querySelector('#undoBtn').onclick=undoAction;
document.querySelector('#redoBtn').onclick=redoAction;
document.querySelector('#saveBtn').onclick=()=>{const data={version:1,layers:root.toJSON(),keyframes};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='tetherless3d-project.json';a.click();URL.revokeObjectURL(a.href);};
document.querySelector('#exportBtn').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='tetherless3d-artwork.png';a.click();};
document.querySelector('#panelBtn').onclick=()=>document.querySelector('#side').classList.toggle('open');
document.querySelector('#keyBtn').onclick=()=>{const g=layers[activeLayer].group;keyframes.push({time:keyframes.length,layer:activeLayer,position:g.position.toArray(),rotation:g.rotation.toArray(),scale:g.scale.toArray()});document.querySelector('#frameInfo').textContent=keyframes.length+' keyframes · layer: '+layers[activeLayer].name;document.querySelector('#frameSlider').max=Math.max(100,keyframes.length*100);};
document.querySelector('#playBtn').onclick=()=>{playing=!playing;if(playing)playStart=performance.now();document.querySelector('#playBtn').textContent=playing?'Ⅱ Pause preview':'▶ Play preview';document.querySelector('#playBtn').classList.toggle('active',playing);};
document.querySelector('#frameSlider').oninput=e=>document.querySelector('#frameNo').textContent=e.target.value;
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();resizeEraserPreview();}
resizeEraserPreview();new ResizeObserver(resize).observe(viewport);
function animate(now){requestAnimationFrame(animate);orbit.update();if(playing&&keyframes.length>1){const duration=Math.max(1,...keyframes.map(k=>k.time));const t=((now-playStart)/1000)%duration;for(let li=0;li<layers.length;li++){const track=keyframes.filter(k=>k.layer===li).sort((a,b)=>a.time-b.time);if(!track.length)continue;let a=track[0],b=track[track.length-1];for(let j=0;j<track.length-1;j++){if(t>=track[j].time&&t<=track[j+1].time){a=track[j];b=track[j+1];break;}}const span=Math.max(.0001,b.time-a.time),f=THREE.MathUtils.clamp((t-a.time)/span,0,1),g=layers[li].group;g.position.fromArray(a.position).lerp(new THREE.Vector3(...b.position),f);g.rotation.set(...a.rotation.map((v,i)=>THREE.MathUtils.lerp(v,b.rotation[i],f)));g.scale.fromArray(a.scale).lerp(new THREE.Vector3(...b.scale),f);}}renderer.render(scene,camera);}
requestAnimationFrame(animate);renderLayers();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
