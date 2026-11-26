// Procedural 2-D illustration, not a cloth simulation or photographic AI.
import {alignGarment,torsoPoint,GARMENT_GEOMETRY} from './virtualFittingGeometry.js';
export const RENDER_MODES=Object.freeze(['demo-shirt','demo-jacket','layered']);
export const FABRICS=Object.freeze({
  shirt:{base:'#8199b6',light:'#b3c7df',dark:'#405a79',seam:'#354a63',texture:'knit'},
  jacket:{base:'#ad9579',light:'#d6c1a2',dark:'#64513f',seam:'#594737',texture:'twill'}
});
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const xy=p=>p.x.toFixed(2)+' '+p.y.toFixed(2);
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function roundedContour(points,radius=.12){
  if(!Array.isArray(points)||points.length<3||!points.every(finitePoint)||!Number.isFinite(radius)||radius<0||radius>.25)return '';
  const corners=points.map((p,i)=>({p,before:lerp(p,points[(i+points.length-1)%points.length],radius),after:lerp(p,points[(i+1)%points.length],radius)}));
  return 'M '+xy(corners[0].before)+' '+corners.map((c,i)=>(i?'L '+xy(c.before)+' ':'')+'Q '+xy(c.p)+' '+xy(c.after)).join(' ')+' Z';
}
function line(points){return 'M '+points.map(xy).join(' L ');}
function curve(points){return 'M '+xy(points[0])+' Q '+xy(points[1])+' '+xy(points[2]);}
function createLayer(fit,type,open){
  const f=fit.frame,spec=GARMENT_GEOMETRY[type==='shirt'?'demo-shirt':'demo-jacket'],half=(spec.ease-1)/2;
  const at=(u,v)=>torsoPoint(f,u,v);
  const edgeL=-half,edgeR=1+half,end=spec.hem;
  const path=(pairs)=>roundedContour(pairs.map(([u,v])=>at(u,v)),.09);
  const panels=open?[
    path([[edgeL,0],[.32,-.065],[.36,.33],[.43,end],[edgeL,end]]),
    path([[.68,-.065],[edgeR,0],[edgeR,end],[.57,end],[.64,.33]])
  ]:[roundedContour(fit.body,.075)];
  const seams=[
    curve([at(edgeL+.06,.31),at(.12,.61),at(edgeL+.04,end-.06)]),
    curve([at(edgeR-.06,.31),at(.88,.61),at(edgeR-.04,end-.06)]),
    line([at(edgeL+.04,end-.055),at(open?.40:edgeR-.04,end-.055)])
  ];
  if(open)seams.push(line([at(.60,end-.055),at(edgeR-.04,end-.055)]));
  if(type==='jacket'){
    seams.push(line([at(.29,-.015),at(.19,.22),at(.38,.40)]),line([at(.71,-.015),at(.81,.22),at(.62,.40)]));
    seams.push(line([at(.08,.70),at(.28,.72)]),line([at(.72,.72),at(.92,.70)]));
    if(!open)seams.push(line(fit.seam));
  }else seams.push(curve(fit.neck));
  const folds=[
    curve([at(.13,.36),at(.24,.47),at(.17,.59)]),
    curve([at(.86,.37),at(.74,.47),at(.84,.63)]),
    curve([at(.24,end-.16),at(.36,end-.10),at(.27,end-.04)]),
    curve([at(.76,end-.17),at(.64,end-.10),at(.73,end-.04)])
  ];
  return {type,open,panels,sleeves:[roundedContour(fit.leftSleeve),roundedContour(fit.rightSleeve)],seams,folds,buttons:type==='jacket'&&!open?[at(.54,.34),at(.54,.54),at(.54,.74)]:[]};
}
export function buildGarmentRenderPlan(pose,width,height,mode){
  if(!RENDER_MODES.includes(mode))return {ok:false,reason:'unsupported_render_mode'};
  const types=mode==='layered'?['shirt','jacket']:[mode==='demo-shirt'?'shirt':'jacket'];
  const layers=[];let frame;
  for(const type of types){
    const fit=alignGarment(pose,width,height,type==='shirt'?'demo-shirt':'demo-jacket');
    if(!fit.ok)return {ok:false,reason:fit.reason};
    frame=fit.frame;
    const layer=createLayer(fit,type,mode==='layered'&&type==='jacket');
    if([...layer.panels,...layer.sleeves,...layer.seams,...layer.folds].some(p=>!p||/NaN|Infinity/.test(p)))return {ok:false,reason:'invalid_render_geometry'};
    layers.push(layer);
  }
  return {ok:true,frame,layers};
}
