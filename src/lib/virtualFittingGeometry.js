// Geometry only: normalized 2-D landmarks in the MediaPipe pose convention.
// No image loading, pose detector execution, body measurements or physical fit claims.
export const FITTING_PRESETS=Object.freeze([
  {id:'balanced',label:'Balanced',shoulders:78,hips:68,torso:113,tilt:0,arm:0},
  {id:'broader',label:'Broader shoulders',shoulders:101,hips:76,torso:115,tilt:0,arm:0},
  {id:'longer',label:'Longer torso',shoulders:73,hips:65,torso:140,tilt:0,arm:0},
  {id:'angled',label:'Slight tilt',shoulders:80,hips:72,torso:115,tilt:0.11,arm:13}
]);
export const GARMENT_GEOMETRY=Object.freeze({
  'demo-shirt':{hem:0.98,ease:1.08,sleeve:0.43},
  'demo-jacket':{hem:1.08,ease:1.16,sleeve:1}
});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const mul=(a,k)=>({x:a.x*k,y:a.y*k});
const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
const mid=(a,b)=>mix(a,b,0.5);
const length=a=>Math.hypot(a.x,a.y);
const unit=a=>mul(a,1/length(a));
const normal=a=>({x:-a.y,y:a.x});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const rejected=reason=>({ok:false,reason});
const inFrame=(p,w,h)=>finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<=w&&p.y<=h;
export function syntheticPose(presetId='balanced',width=300,height=390){
  const preset=FITTING_PRESETS.find(p=>p.id===presetId);
  if(!preset||!finite(width)||!finite(height)||width<=0||height<=0)return [];
  const {shoulders,hips,torso,tilt,arm}=preset;
  const origin={x:150,y:105};
  const coords={
    11:[shoulders/2,0],12:[-shoulders/2,0],
    13:[shoulders/2+16,55],14:[-shoulders/2-16,55],
    15:[shoulders/2+27+arm,105],16:[-shoulders/2-27-arm,105],
    23:[hips/2,torso],24:[-hips/2,torso],
  };
  const pose=Array(33).fill(null);
  for(const [index,[x,y]] of Object.entries(coords)){
    const px=origin.x+x*Math.cos(tilt)-y*Math.sin(tilt);
    const py=origin.y+x*Math.sin(tilt)+y*Math.cos(tilt);
    // Synthetic coordinates retain the same proportions in a differently sized viewport.
    pose[index]={x:px/300,y:py/390,visibility:1};
  }
  return pose;
}
// Accept detector-shaped input but require explicit confidence and a supported frontal pose.
export function createTorsoFrame(landmarks,width,height){
  if(!Array.isArray(landmarks)||!finite(width)||!finite(height)||width<1||height<1||width>8192||height>8192)return rejected('invalid_frame');
  const required=[11,12,13,14,15,16,23,24];
  const points={};
  for(const index of required){
    const p=landmarks[index];
    if(!p||!finite(p.x)||!finite(p.y)||!finite(p.visibility)||p.visibility<0.7||p.x<0||p.x>1||p.y<0||p.y>1)return rejected('missing_or_low_confidence_landmark');
    points[index]={x:p.x*width,y:p.y*height};
  }
  const screenLeft=points[11].x<points[12].x?11:12;
  const screenRight=screenLeft===11?12:11;
  const side=i=>({shoulder:points[i],elbow:points[i+2],wrist:points[i+4],hip:points[i+12]});
  const left=side(screenLeft),right=side(screenRight);
  const shoulderCenter=mid(left.shoulder,right.shoulder);
  const hipCenter=mid(left.hip,right.hip);
  const shoulderVector=sub(right.shoulder,left.shoulder);
  const hipVector=sub(right.hip,left.hip);
  const down=sub(hipCenter,shoulderCenter);
  const sw=length(shoulderVector),hw=length(hipVector),th=length(down);
  const scale=Math.min(width,height);
  if(sw<scale*.09||hw<sw*.45||hw>sw*1.5||th<sw*.65||th>sw*2.4||down.y<th*.85||Math.abs(shoulderVector.y)>sw*.30||Math.abs(hipVector.y)>hw*.30||cross(shoulderVector,down)<=0||cross(hipVector,down)<=0||Math.abs(dot(unit(shoulderVector),unit(down)))>.30||dot(unit(shoulderVector),unit(hipVector))<.95)return rejected('unsupported_torso_pose');
  for(const arm of [left,right]){
    const upper=sub(arm.elbow,arm.shoulder),lower=sub(arm.wrist,arm.elbow);
    if(length(upper)<sw*.22||length(lower)<sw*.22||length(upper)>sw*1.3||length(lower)>sw*1.3||upper.y<=0||lower.y<=0||dot(unit(upper),unit(lower))<.35)return rejected('unsupported_arm_pose');
  }
  if(left.elbow.x>shoulderCenter.x||left.wrist.x>shoulderCenter.x||right.elbow.x<shoulderCenter.x||right.wrist.x<shoulderCenter.x)return rejected('crossed_arm_pose');
  return {ok:true,width,height,left,right,shoulderCenter,hipCenter,shoulderWidth:sw,torsoLength:th};
}
// Bilinear torso interpolation preserves independent shoulder and hip proportions.
export function torsoPoint(frame,u,v){
  const left=mix(frame.left.shoulder,frame.left.hip,v);
  const right=mix(frame.right.shoulder,frame.right.hip,v);
  return mix(left,right,u);
}
export function alignGarment(landmarks,width,height,garmentId){
  const spec=GARMENT_GEOMETRY[garmentId];
  if(!Object.hasOwn(GARMENT_GEOMETRY,garmentId))return rejected('unsupported_garment');
  const frame=createTorsoFrame(landmarks,width,height);
  if(!frame.ok)return frame;
  const {left,right,shoulderWidth:sw}=frame;
  const half=(spec.ease-1)/2;
  const map=(u,v)=>torsoPoint(frame,u,v);
  const body=[map(-half,0),map(.32,-.065),map(.5,.10),map(.68,-.065),map(1+half,0),map(1+half,spec.hem),map(-half,spec.hem)];
  const sleeve=arm=>{
    const upper=unit(sub(arm.elbow,arm.shoulder)),lower=unit(sub(arm.wrist,arm.elbow));
    const bend=unit(add(upper,lower));
    const end=spec.sleeve===1?arm.wrist:mix(arm.shoulder,arm.elbow,spec.sleeve);
    const start=arm.shoulder;
    const offsets=(p,dir,w)=>[add(p,mul(normal(dir),w)),add(p,mul(normal(dir),-w))];
    const [a,b]=offsets(start,upper,sw*.125*spec.ease);
    const [c,d]=offsets(end,spec.sleeve===1?lower:upper,sw*(spec.sleeve===1?.08:.105)*spec.ease);
    if(spec.sleeve!==1)return [a,c,d,b];
    const [e,f]=offsets(arm.elbow,bend,sw*.10*spec.ease);
    return [a,e,c,d,f,b];
  };
  const leftSleeve=sleeve(left),rightSleeve=sleeve(right);
  const seam=[map(.5,.10),map(.5,spec.hem)];
  const neck=[map(.32,-.065),map(.5,.10),map(.68,-.065)];
  const hem=[map(-half,spec.hem-.055),map(1+half,spec.hem-.055)];
  if(![...body,...leftSleeve,...rightSleeve,...seam,...neck,...hem].every(p=>inFrame(p,width,height)))return rejected('garment_outside_frame');
  return {ok:true,frame,body,leftSleeve,rightSleeve,seam,neck,hem};
}
export function svgPoints(points){return points.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');}
