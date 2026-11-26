// Original synthetic outfit illustrations only; never a catalog or fit claim.
import {buildGarmentRenderPlan,roundedContour} from './garmentRenderPlan.js';
import {syntheticPose,torsoPoint} from './virtualFittingGeometry.js';
export const OUTFIT_PALETTES=Object.freeze({
 classic:{shirt:'#8199b6',jacket:'#ad9579',bottom:'#36485d',dress:'#77465b',shoe:'#47392d'},
 monochrome:{shirt:'#c3c4c6',jacket:'#41464d',bottom:'#272c32',dress:'#444a53',shoe:'#252525'},
 warm:{shirt:'#eee0c8',jacket:'#84664e',bottom:'#6b7254',dress:'#a56643',shoe:'#62452e'}
});
export const OUTFIT_DEFAULT=Object.freeze({base:'separates',outer:'jacket',bottom:'trousers',shoes:'loafers',palette:'classic',preset:'balanced'});
const choices={base:['separates','dress'],outer:['none','jacket'],bottom:['trousers','skirt'],shoes:['none','loafers'],palette:Object.keys(OUTFIT_PALETTES),preset:['balanced','broader','longer','angled']};
export function changeOutfit(current,key,value){
 if(!Object.hasOwn(choices,key)||!choices[key].includes(value))return current;
 return {...current,[key]:value};
}
export function buildOutfitPreview(config){
 if(!config||Object.keys(choices).some(k=>!choices[k].includes(config[k])))return {ok:false,reason:'unsupported_outfit'};
 const pose=syntheticPose(config.preset);
 const upper=buildGarmentRenderPlan(pose,300,390,config.outer==='jacket'?'layered':'demo-shirt');
 if(!upper.ok)return upper;
 const f=upper.frame;
 const c=OUTFIT_PALETTES[config.palette];
 const at=(u,v)=>torsoPoint(f,u,v);
 const p=(x,y)=>({x,y});
 const left=f.left.hip.x,right=f.right.hip.x,mid=f.hipCenter.x,hip=f.hipCenter.y;
 const hem=352,knee=hip+(hem-hip)*.51;
 const paths=[];
 const add=(points,fill,role)=>paths.push({d:roundedContour(points,.07),fill,role});
 if(config.base==='separates'&&config.bottom==='trousers'){
  add([p(left-3,hip-6),p(mid,hip-5),p(mid-1,knee),p(mid-5,hem),p(left+6,hem),p(left-4,knee)],c.bottom,'trouser-left');
  add([p(mid,hip-5),p(right+3,hip-6),p(right+4,knee),p(right-6,hem),p(mid+5,hem),p(mid+1,knee)],c.bottom,'trouser-right');
 }else{
  // Dress uses one continuous silhouette; skirt begins at hips.
  const skirtHem=Math.min(hem-22,hip+72);
  const points=config.base==='dress'?[at(.02,0),at(.32,-.065),at(.5,.12),at(.68,-.065),at(.98,0),at(.96,.9),p(right+11,skirtHem),p(left-11,skirtHem),at(.04,.9)]:[p(left-3,hip-7),p(right+3,hip-7),p(right+12,skirtHem),p(left-12,skirtHem)];
  add(points,config.base==='dress'?c.dress:c.bottom,config.base==='dress'?'dress':'skirt');
 }
 if(config.shoes==='loafers'){
  add([p(left+4,hem-2),p(left+19,hem-2),p(left+21,hem+10),p(left-2,hem+10),p(left-6,hem+5)],c.shoe,'shoe-left');
  add([p(right-19,hem-2),p(right-4,hem-2),p(right+6,hem+5),p(right+2,hem+10),p(right-21,hem+10)],c.shoe,'shoe-right');
 }
 if(paths.some(x=>!x.d||/NaN|Infinity/.test(x.d)))return {ok:false,reason:'invalid_outfit_geometry'};
 const layers=upper.layers.filter(l=>config.base!=='dress'||l.type==='jacket').map(l=>({...l,baseColor:c[l.type]}));
 return {ok:true,frame:f,paths,layers,scope:'synthetic_illustration',fitVerified:false};
}
